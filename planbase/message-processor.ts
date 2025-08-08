import { DataManager } from './data-manager.js';
import { TicketmasterService } from './helpers/ticketmaster.js';
import { EventRouter } from './router.js';
import {
  MessageContext,
  MessageResponse,
  QuickActionSet,
  QuickAction,
  UserProfile,
  SearchQuery,
  SearchParams,
  PendingAction,
  EventData
} from './types/index.js';
import OpenAI from 'openai';

export class MessageProcessor {
  private dataManager: DataManager;
  private ticketmasterService: TicketmasterService;
  private openai: OpenAI;

  constructor(dataManager: DataManager, ticketmasterService: TicketmasterService, openai: OpenAI) {
    this.dataManager = dataManager;
    this.ticketmasterService = ticketmasterService;
    this.openai = openai;
  }

  async processMessage(message: any, conversation: any): Promise<MessageResponse> {
    const messageContent = message.content as string;
    const senderInboxId = message.senderInboxId;
    const conversationId = message.conversationId;
    const timestamp = new Date(message.sentAt);

    // Update user activity
    this.dataManager.updateUserActivity(senderInboxId);

    // Get or create user profile
    let userProfile = this.dataManager.getUserProfile(senderInboxId);
    if (!userProfile) {
      userProfile = this.dataManager.createUserProfile(senderInboxId);
    }

    // Create message context
    const context: MessageContext = {
      isGroup: conversation instanceof (await import('@xmtp/node-sdk')).Group,
      isMentioned: this.isAgentMentioned(messageContent, conversation),
      isReply: false, // TODO: Implement reply detection
      messageContent,
      senderInboxId,
      conversationId,
      timestamp
    };

    // Check for hardcoded responses first
    const commands = EventRouter.parseMessage(messageContent);
    if (commands.length > 0) {
      const response = EventRouter.getResponse(context);
      return { content: response };
    }

    // Handle RSVP flow
    if (messageContent.toLowerCase().startsWith('/rsvp')) {
      return await this.handleRsvpFlow(messageContent, senderInboxId, context);
    }

    // Handle pending actions
    const pendingActions = this.dataManager.getPendingActions(senderInboxId);
    if (pendingActions.length > 0) {
      const response = await this.handlePendingActions(messageContent, senderInboxId, pendingActions, context);
      if (response) return response;
    }

    // Handle event searches
    const isEventQuery = await this.detectEventQuery(messageContent);
    if (isEventQuery) {
      return await this.handleEventSearch(messageContent, senderInboxId, context);
    }

    // Default response
    return await this.generateDefaultResponse(messageContent, context);
  }

  private isAgentMentioned(messageContent: string, conversation: any): boolean {
    const lowerContent = messageContent.toLowerCase();
    const agentMentions = [
      '@wellness',
      '@wellnessconnections',
      '@wellnessagent',
      '@agent',
      '@planbase.base.eth'
    ];
    
    return agentMentions.some(mention => lowerContent.includes(mention));
  }

  private async handleRsvpFlow(messageContent: string, senderInboxId: string, context: MessageContext): Promise<MessageResponse> {
    const artist = messageContent.substring(6).trim(); // Remove '/rsvp ' prefix
    
    if (artist) {
      // User provided artist name - search for events
      const searchResult = await this.ticketmasterService.aiSearch(artist, context.isGroup ? undefined : undefined);
      
      if (searchResult.events.length > 0) {
        // Convert Ticketmaster events to our structured format
        const events: EventData[] = searchResult.events.map(tmEvent => 
          this.dataManager.convertTicketmasterEvent(tmEvent)
        );

        // Store events in our data manager
        events.forEach(event => this.dataManager.addEvent(event));

        // Create Quick Actions for RSVP
        const quickActions: QuickActionSet = {
          id: `rsvp_${artist}_${Date.now()}`,
          description: `Found events for ${artist}:\n\n${this.formatEventsList(events)}\n\nWould you like to RSVP?`,
          actions: [
            { id: 'rsvp_yes', label: 'Yes', style: 'primary', action: 'rsvp_yes' },
            { id: 'rsvp_maybe', label: 'Maybe', style: 'secondary', action: 'rsvp_maybe' },
            { id: 'rsvp_no', label: 'No', style: 'danger', action: 'rsvp_no' }
          ],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          context: 'rsvp'
        };

        // Add pending action for RSVP
        const pendingAction: PendingAction = {
          id: quickActions.id,
          type: 'rsvp_request',
          userId: senderInboxId,
          data: { artist, events: events.map(e => e.id) },
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
        this.dataManager.addPendingAction(senderInboxId, pendingAction);

        return {
          content: quickActions.description,
          quickActions
        };
      } else {
        return { content: `No events found for ${artist}. Try searching for a different artist or check back later!` };
      }
    } else {
      // No artist provided - ask for artist name
      const pendingAction: PendingAction = {
        id: `rsvp_request_${Date.now()}`,
        type: 'rsvp_request',
        userId: senderInboxId,
        data: { waitingForArtist: true },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      };
      this.dataManager.addPendingAction(senderInboxId, pendingAction);

      return { content: "Which artist would you like to RSVP to? Please reply with the artist name." };
    }
  }

  private async handlePendingActions(
    messageContent: string, 
    senderInboxId: string, 
    pendingActions: PendingAction[], 
    context: MessageContext
  ): Promise<MessageResponse | null> {
    for (const action of pendingActions) {
      if (action.type === 'rsvp_request') {
        if (action.data.waitingForArtist) {
          // User is providing artist name after /rsvp
          const artist = messageContent.trim();
          this.dataManager.removePendingAction(senderInboxId, action.id);
          
          // Process the artist name
          return await this.handleRsvpFlow(`/rsvp ${artist}`, senderInboxId, context);
        }
      }
    }
    return null;
  }

  private async detectEventQuery(messageContent: string): Promise<boolean> {
    const eventQueryPrompt = `Determine if the user is asking about events, concerts, shows, or entertainment. Respond with ONLY "true" or "false".

Examples:
"Rock music in Miami" -> true
"Pop shows in Austin" -> true
"Hello how are you" -> false
"What's the weather" -> false
"Tell me a joke" -> false

User message: "${messageContent}"`;

    const eventQueryResponse = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: eventQueryPrompt }],
      max_tokens: 10,
      temperature: 0,
    });

    return eventQueryResponse.choices[0]?.message?.content?.toLowerCase().includes('true') || false;
  }

  private async handleEventSearch(messageContent: string, senderInboxId: string, context: MessageContext): Promise<MessageResponse> {
    const userProfile = this.dataManager.getUserProfile(senderInboxId);
    const searchResult = await this.ticketmasterService.aiSearch(messageContent, userProfile?.city);

    if (searchResult.events.length > 0) {
      // Convert and store events
      const events: EventData[] = searchResult.events.map(tmEvent => 
        this.dataManager.convertTicketmasterEvent(tmEvent)
      );
      events.forEach(event => this.dataManager.addEvent(event));

      // Store search query
      const searchQuery: SearchQuery = {
        id: `search_${Date.now()}`,
        userId: senderInboxId,
        query: messageContent,
        parsedParams: searchResult.searchParams,
        results: events,
        createdAt: new Date()
      };
      this.dataManager.addSearchQuery(senderInboxId, searchQuery);

      // Create Quick Actions
      const quickActions: QuickActionSet = {
        id: `events_${Date.now()}`,
        description: `${searchResult.explanation}\n\n${this.formatEventsList(events)}\n\nWhat would you like to do?`,
        actions: [
          { id: 'rsvp_events', label: 'RSVP to Events', style: 'primary', action: 'rsvp_events' },
          { id: 'get_tickets', label: 'Get Tickets', style: 'secondary', action: 'get_tickets' },
          { id: 'more_info', label: 'More Info', style: 'secondary', action: 'more_info' }
        ],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        context: 'event_search'
      };

      return {
        content: quickActions.description,
        quickActions
      };
    } else {
      return { content: `${searchResult.explanation}\n\nNo events found. Try searching for a different artist or location!` };
    }
  }

  private async generateDefaultResponse(messageContent: string, context: MessageContext): Promise<MessageResponse> {
    // Check for simple greetings
    const simpleGreetings = ['hey', 'hi', 'hello', 'sup', 'whats up', 'yo'];
    if (simpleGreetings.some(greeting => messageContent.toLowerCase().includes(greeting))) {
      return { content: "Hi! I'm your event assistant. I can help you find concerts and shows, or tell you about upcoming events. What would you like to know?" };
    }

    // Use OpenAI for natural responses
    const systemPrompt = `You are a helpful event finder. Keep responses short and friendly.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: messageContent }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || "I'm here to help!";
    return { content: response };
  }

  private formatEventsList(events: EventData[]): string {
    if (events.length === 0) {
      return "No events found.";
    }

    // Filter out past events
    const now = new Date();
    const upcomingEvents = events.filter(event => event.date > now);

    if (upcomingEvents.length === 0) {
      return "No upcoming events found.";
    }

    // Sort by date and limit to 5 events
    const eventsToShow = upcomingEvents
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);

    return eventsToShow.map(event => {
      const formattedDate = event.date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      return `${event.name}, ${formattedDate}, ${event.venue.name}`;
    }).join('\n');
  }

  // Handle Quick Action responses
  async handleQuickAction(actionId: string, userId: string): Promise<MessageResponse> {
    const pendingActions = this.dataManager.getPendingActions(userId);
    const action = pendingActions.find(a => a.id === actionId);

    if (action && action.type === 'rsvp_request') {
      // Handle RSVP response
      const status = actionId.includes('yes') ? 'yes' : actionId.includes('maybe') ? 'maybe' : 'no';
      
      if (action.data.events) {
        // Create RSVP for each event
        action.data.events.forEach((eventId: string) => {
          this.dataManager.createRsvp(eventId, userId, status);
        });
      }

      this.dataManager.removePendingAction(userId, actionId);
      return { content: `RSVP recorded: ${status}! Thanks for letting us know.` };
    }

    return { content: "Action processed successfully!" };
  }
} 