import fs from 'fs';
import path from 'path';
import {
  DataStore,
  UserProfile,
  EventData,
  RsvpData,
  SearchQuery,
  ConversationContext,
  PendingAction,
  XmtpMessage,
  SearchParams,
  EventMetadata,
  VenueData,
  PriceData,
  TicketmasterEvent
} from './types/index.js';

export class DataManager {
  private dataStore: DataStore;
  private dataDir: string;
  private dataFiles: {
    users: string;
    events: string;
    rsvps: string;
    searchHistory: string;
    conversations: string;
    pendingActions: string;
  };

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.dataFiles = {
      users: path.join(dataDir, 'users.json'),
      events: path.join(dataDir, 'events.json'),
      rsvps: path.join(dataDir, 'rsvps.json'),
      searchHistory: path.join(dataDir, 'search-history.json'),
      conversations: path.join(dataDir, 'conversations.json'),
      pendingActions: path.join(dataDir, 'pending-actions.json')
    };

    // Initialize data store
    this.dataStore = {
      users: new Map(),
      events: new Map(),
      rsvps: new Map(),
      searchHistory: new Map(),
      conversations: new Map(),
      pendingActions: new Map()
    };

    this.ensureDataDirectory();
    this.loadData();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadData(): void {
    try {
      // Load users
      if (fs.existsSync(this.dataFiles.users)) {
        const usersData = JSON.parse(fs.readFileSync(this.dataFiles.users, 'utf8'));
        this.dataStore.users = new Map(Object.entries(usersData).map(([key, value]) => [
          key,
          this.deserializeUserProfile(value as any)
        ]));
      }

      // Load events
      if (fs.existsSync(this.dataFiles.events)) {
        const eventsData = JSON.parse(fs.readFileSync(this.dataFiles.events, 'utf8'));
        this.dataStore.events = new Map(Object.entries(eventsData).map(([key, value]) => [
          key,
          this.deserializeEventData(value as any)
        ]));
      }

      // Load RSVPs
      if (fs.existsSync(this.dataFiles.rsvps)) {
        const rsvpsData = JSON.parse(fs.readFileSync(this.dataFiles.rsvps, 'utf8'));
        this.dataStore.rsvps = new Map(Object.entries(rsvpsData).map(([key, value]) => [
          key,
          this.deserializeRsvpData(value as any)
        ]));
      }

      // Load search history
      if (fs.existsSync(this.dataFiles.searchHistory)) {
        const searchData = JSON.parse(fs.readFileSync(this.dataFiles.searchHistory, 'utf8'));
        this.dataStore.searchHistory = new Map(Object.entries(searchData).map(([key, value]) => [
          key,
          (value as any[]).map(item => this.deserializeSearchQuery(item))
        ]));
      }

      // Load conversations
      if (fs.existsSync(this.dataFiles.conversations)) {
        const conversationsData = JSON.parse(fs.readFileSync(this.dataFiles.conversations, 'utf8'));
        this.dataStore.conversations = new Map(Object.entries(conversationsData).map(([key, value]) => [
          key,
          this.deserializeConversationContext(value as any)
        ]));
      }

      // Load pending actions
      if (fs.existsSync(this.dataFiles.pendingActions)) {
        const pendingData = JSON.parse(fs.readFileSync(this.dataFiles.pendingActions, 'utf8'));
        this.dataStore.pendingActions = new Map(Object.entries(pendingData).map(([key, value]) => [
          key,
          (value as any[]).map(item => this.deserializePendingAction(item))
        ]));
      }

      console.log('✅ Data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading data:', error);
    }
  }

  private saveData(): void {
    try {
      // Save users
      const usersData = Object.fromEntries(this.dataStore.users);
      fs.writeFileSync(this.dataFiles.users, JSON.stringify(usersData, null, 2));

      // Save events
      const eventsData = Object.fromEntries(this.dataStore.events);
      fs.writeFileSync(this.dataFiles.events, JSON.stringify(eventsData, null, 2));

      // Save RSVPs
      const rsvpsData = Object.fromEntries(this.dataStore.rsvps);
      fs.writeFileSync(this.dataFiles.rsvps, JSON.stringify(rsvpsData, null, 2));

      // Save search history
      const searchData = Object.fromEntries(this.dataStore.searchHistory);
      fs.writeFileSync(this.dataFiles.searchHistory, JSON.stringify(searchData, null, 2));

      // Save conversations
      const conversationsData = Object.fromEntries(this.dataStore.conversations);
      fs.writeFileSync(this.dataFiles.conversations, JSON.stringify(conversationsData, null, 2));

      // Save pending actions
      const pendingData = Object.fromEntries(this.dataStore.pendingActions);
      fs.writeFileSync(this.dataFiles.pendingActions, JSON.stringify(pendingData, null, 2));

      console.log('💾 Data saved successfully');
    } catch (error) {
      console.error('❌ Error saving data:', error);
    }
  }

  // User Management
  getUserProfile(inboxId: string): UserProfile | undefined {
    return this.dataStore.users.get(inboxId);
  }

  createUserProfile(inboxId: string, address?: string): UserProfile {
    const userProfile: UserProfile = {
      inboxId,
      address,
      preferences: {
        eventTypes: [],
        notificationSettings: {
          eventReminders: true,
          newEvents: true,
          rsvpUpdates: true,
          directMessages: true
        },
        privacySettings: {
          shareLocation: false,
          sharePreferences: false,
          allowTracking: true
        }
      },
      metadata: {
        createdAt: new Date(),
        lastActive: new Date(),
        messageCount: 0
      }
    };

    this.dataStore.users.set(inboxId, userProfile);
    this.saveData();
    return userProfile;
  }

  updateUserProfile(inboxId: string, updates: Partial<UserProfile>): UserProfile {
    const user = this.getUserProfile(inboxId) || this.createUserProfile(inboxId);
    const updatedUser = { ...user, ...updates };
    this.dataStore.users.set(inboxId, updatedUser);
    this.saveData();
    return updatedUser;
  }

  updateUserActivity(inboxId: string): void {
    const user = this.getUserProfile(inboxId);
    if (user) {
      user.metadata.lastActive = new Date();
      user.metadata.messageCount++;
      this.saveData();
    }
  }

  // Event Management
  addEvent(event: EventData): void {
    this.dataStore.events.set(event.id, event);
    this.saveData();
  }

  getEvent(eventId: string): EventData | undefined {
    return this.dataStore.events.get(eventId);
  }

  updateEvent(eventId: string, updates: Partial<EventData>): EventData | undefined {
    const event = this.getEvent(eventId);
    if (event) {
      const updatedEvent = { ...event, ...updates, metadata: { ...event.metadata, updatedAt: new Date() } };
      this.dataStore.events.set(eventId, updatedEvent);
      this.saveData();
      return updatedEvent;
    }
    return undefined;
  }

  // RSVP Management
  createRsvp(eventId: string, userId: string, status: 'yes' | 'maybe' | 'no', notes?: string): RsvpData {
    const rsvp: RsvpData = {
      id: `${eventId}_${userId}_${Date.now()}`,
      eventId,
      userId,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      notes
    };

    this.dataStore.rsvps.set(rsvp.id, rsvp);
    this.saveData();
    return rsvp;
  }

  getRsvp(rsvpId: string): RsvpData | undefined {
    return this.dataStore.rsvps.get(rsvpId);
  }

  getUserRsvps(userId: string): RsvpData[] {
    return Array.from(this.dataStore.rsvps.values()).filter(rsvp => rsvp.userId === userId);
  }

  // Search History Management
  addSearchQuery(userId: string, query: SearchQuery): void {
    const userHistory = this.dataStore.searchHistory.get(userId) || [];
    userHistory.unshift(query);
    // Keep only last 10 searches
    if (userHistory.length > 10) {
      userHistory.splice(10);
    }
    this.dataStore.searchHistory.set(userId, userHistory);
    this.saveData();
  }

  getUserSearchHistory(userId: string): SearchQuery[] {
    return this.dataStore.searchHistory.get(userId) || [];
  }

  // Conversation Management
  getConversationContext(conversationId: string): ConversationContext | undefined {
    return this.dataStore.conversations.get(conversationId);
  }

  createConversationContext(conversationId: string, participants: string[], type: 'direct' | 'group'): ConversationContext {
    const context: ConversationContext = {
      conversationId,
      participants,
      type,
      lastActivity: new Date(),
      pendingActions: [],
      userPreferences: new Map()
    };

    this.dataStore.conversations.set(conversationId, context);
    this.saveData();
    return context;
  }

  updateConversationActivity(conversationId: string): void {
    const context = this.getConversationContext(conversationId);
    if (context) {
      context.lastActivity = new Date();
      this.saveData();
    }
  }

  // Pending Actions Management
  addPendingAction(userId: string, action: PendingAction): void {
    const userActions = this.dataStore.pendingActions.get(userId) || [];
    userActions.push(action);
    this.dataStore.pendingActions.set(userId, userActions);
    this.saveData();
  }

  getPendingActions(userId: string): PendingAction[] {
    return this.dataStore.pendingActions.get(userId) || [];
  }

  removePendingAction(userId: string, actionId: string): void {
    const userActions = this.dataStore.pendingActions.get(userId) || [];
    const filteredActions = userActions.filter(action => action.id !== actionId);
    this.dataStore.pendingActions.set(userId, filteredActions);
    this.saveData();
  }

  // Utility Methods
  convertTicketmasterEvent(tmEvent: TicketmasterEvent): EventData {
    const eventDate = new Date(tmEvent.dates.start.localDate + ' ' + (tmEvent.dates.start.localTime || '00:00:00'));
    const venue = tmEvent._embedded?.venues?.[0];
    
    const venueData: VenueData = {
      name: venue?.name || 'TBD',
      city: venue?.city?.name || 'TBD',
      state: venue?.state?.name
    };

    const metadata: EventMetadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      searchQueries: [],
      externalId: tmEvent.id
    };

    return {
      id: tmEvent.id,
      name: tmEvent.name,
      date: eventDate,
      venue: venueData,
      ticketUrl: tmEvent.url,
      status: 'upcoming',
      source: 'ticketmaster',
      metadata
    };
  }

  // Data Serialization/Deserialization
  private deserializeUserProfile(data: any): UserProfile {
    return {
      ...data,
      metadata: {
        ...data.metadata,
        createdAt: new Date(data.metadata.createdAt),
        lastActive: new Date(data.metadata.lastActive)
      }
    };
  }

  private deserializeEventData(data: any): EventData {
    return {
      ...data,
      date: new Date(data.date),
      metadata: {
        ...data.metadata,
        createdAt: new Date(data.metadata.createdAt),
        updatedAt: new Date(data.metadata.updatedAt)
      }
    };
  }

  private deserializeRsvpData(data: any): RsvpData {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }

  private deserializeSearchQuery(data: any): SearchQuery {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      parsedParams: {
        ...data.parsedParams,
        dateRange: data.parsedParams.dateRange ? {
          startDate: new Date(data.parsedParams.dateRange.startDate),
          endDate: new Date(data.parsedParams.dateRange.endDate)
        } : undefined
      }
    };
  }

  private deserializeConversationContext(data: any): ConversationContext {
    return {
      ...data,
      lastActivity: new Date(data.lastActivity),
      pendingActions: data.pendingActions.map((action: any) => ({
        ...action,
        createdAt: new Date(action.createdAt),
        expiresAt: new Date(action.expiresAt)
      })),
      userPreferences: new Map(Object.entries(data.userPreferences || {}))
    };
  }

  private deserializePendingAction(data: any): PendingAction {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      expiresAt: new Date(data.expiresAt)
    };
  }

  // Cleanup expired pending actions
  cleanupExpiredActions(): void {
    const now = new Date();
    for (const [userId, actions] of this.dataStore.pendingActions.entries()) {
      const validActions = actions.filter(action => action.expiresAt > now);
      this.dataStore.pendingActions.set(userId, validActions);
    }
    this.saveData();
  }

  // Get statistics
  getStats(): {
    totalUsers: number;
    totalEvents: number;
    totalRsvps: number;
    totalConversations: number;
    pendingActions: number;
  } {
    return {
      totalUsers: this.dataStore.users.size,
      totalEvents: this.dataStore.events.size,
      totalRsvps: this.dataStore.rsvps.size,
      totalConversations: this.dataStore.conversations.size,
      pendingActions: Array.from(this.dataStore.pendingActions.values()).flat().length
    };
  }
} 