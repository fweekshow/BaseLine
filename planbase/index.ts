import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "./helpers/client.js";
import { Client, Group, type XmtpEnv } from "@xmtp/node-sdk";
import OpenAI from "openai";
import { WellnessRouter, type MessageContext } from './router.js';
import { getCombinedResponse } from './data.js';
import { TicketmasterService, type TicketmasterEvent } from './helpers/ticketmaster.js';

import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, OPENAI_API_KEY, TICKETMASTER_API_KEY, XMTP_ENV } =
  validateEnvironment([
    "WALLET_KEY",
    "ENCRYPTION_KEY",
    "OPENAI_API_KEY",
    "TICKETMASTER_API_KEY",
    "XMTP_ENV",
  ]);

/* Initialize the OpenAI client */
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/* Initialize the Ticketmaster service */
const ticketmasterService = new TicketmasterService(TICKETMASTER_API_KEY, openai);

// Simple in-memory storage for user cities (in production, use a database)
const userCities = new Map<string, string>();
const userAddresses = new Map<string, string>();
const pendingAddressRequests = new Set<string>();
const pendingCityRequests = new Set<string>();
const pendingRsvpRequests = new Map<string, boolean>();

/**
 * Main function to run the Wellness Connections agent
 */
async function main() {
  console.log("🚀 Starting Wellness Connections agent...");
  
  /* Create the signer using viem and parse the encryption key for the local db */
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  console.log("📡 Creating XMTP client...");
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  console.log("✅ XMTP client created successfully");
  void logAgentDetails(client);

  /* Sync the conversations from the network to update the local db */
  console.log("✓ Syncing conversations...");
  await client.conversations.sync();
  console.log("✅ Conversations synced successfully");

  // Stream all messages for wellness responses
  const messageStream = async () => {
    console.log("🤖 Wellness Connections agent is listening...");
    
    try {
      console.log("📡 Starting message stream...");
    const stream = client.conversations.streamAllMessages();
      console.log("📡 Message stream started, waiting for messages...");
      
    for await (const message of await stream) {
        console.log(`📨 Raw message received: ${message.content} from ${message.senderInboxId}`);
        console.log(`📨 Message timestamp: ${message.sentAt}`);
        console.log(`📨 Conversation ID: ${message.conversationId}`);
        console.log(`📨 Content type: ${message.contentType?.typeId}`);
        console.log(`📨 Sender inbox ID: ${message.senderInboxId}`);
        console.log(`📨 Client inbox ID: ${client.inboxId}`);
        
      /* Ignore messages from the same agent or non-text messages */
      if (message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
          console.log("⏭️ Skipping message (from self)");
        continue;
      }
      
      // Accept text, reaction, and reply content types, but only process if we have content
      if (message.contentType?.typeId !== "text" && message.contentType?.typeId !== "reaction" && message.contentType?.typeId !== "reply") {
          console.log("⏭️ Skipping message (not text, reaction, or reply content type)");
        continue;
      }
      
      if (!message.content) {
          console.log("⏭️ Skipping message (no content)");
        continue;
      }

      const messageContent = message.content as string;
      const logMessage = `[${new Date().toISOString()}] 📨 Received: "${messageContent}" from ${message.senderInboxId}`;
      console.log(logMessage);
      console.log(`🔍 Processing message: "${messageContent}"`);
      
      // Also log to file
      fs.appendFileSync('bot-logs.txt', logMessage + '\n');
      
      // Log processing start
      const processLog = `[${new Date().toISOString()}] 🔍 Starting to process message`;
      console.log(processLog);
      fs.appendFileSync('bot-logs.txt', processLog + '\n');

      /* Get the conversation from the local db */
        console.log("🔍 Getting conversation...");
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      /* If the conversation is not found, skip the message */
      if (!conversation) {
        console.log("❌ Unable to find conversation, skipping");
        continue;
      }

        console.log("✅ Conversation found, processing...");

      try {
        // Determine if this is a group conversation (following XMTP SDK patterns)
        const isGroup = conversation instanceof Group;
        console.log(`📝 Conversation type: ${isGroup ? 'Group' : 'DM'}`);
        console.log(`📝 Conversation ID: ${conversation.id}`);
        console.log(`📝 Conversation constructor: ${conversation.constructor.name}`);
        console.log(`📝 Is Group instance: ${conversation instanceof Group}`);
        
        // Get agent's address for mention detection
        const agentAddress = client.accountIdentifier?.identifier;
          console.log(`🤖 Agent address: ${agentAddress}`);
        
        // Check if agent is mentioned (for group chats) - look for @mentions of agent's address or common names
        const isMentioned = isGroup && (
          messageContent.toLowerCase().includes('@wellness') || 
          messageContent.toLowerCase().includes('@wellnessconnections') ||
          messageContent.toLowerCase().includes('@wellnessagent') ||
          messageContent.toLowerCase().includes('@agent') ||
          (agentAddress && messageContent.toLowerCase().includes(agentAddress.toLowerCase())) ||
          messageContent.toLowerCase().includes('@planbase.base.eth') // User's basename
        );
          
          console.log(`📢 Mentioned in group: ${isMentioned}`);
        
        // Only respond in solo chats or if mentioned in groups
        if (isGroup && !isMentioned) {
            console.log("⏭️ Skipping group message (not mentioned)");
          continue;
        }

        // Get user's city for context
        const userCity = userCities.get(message.senderInboxId) || 'your area';

        // Proactive greeting handling
        const simpleGreetings = ['hey', 'hi', 'hello', 'sup', 'whats up', 'yo'];
        const lowerMsg = messageContent.trim().toLowerCase();
        if (simpleGreetings.some(g => lowerMsg === g || lowerMsg.startsWith(g + ' '))) {
          if (!userCities.get(message.senderInboxId)) {
            pendingCityRequests.add(message.senderInboxId);
            await conversation.send("Hi! I can help you find events. Which city are you in?");
          } else {
            await conversation.send(`Hi! I can help you find events in ${userCities.get(message.senderInboxId)}. What artists or types of events are you into?`);
          }
          continue;
        }

        // Capture city if we're awaiting it
        if (pendingCityRequests.has(message.senderInboxId)) {
          const potentialCity = messageContent.trim();
          if (potentialCity.length >= 2) {
            userCities.set(message.senderInboxId, potentialCity);
            pendingCityRequests.delete(message.senderInboxId);
            await conversation.send(`Great, I'll look for events in ${potentialCity}. What artists or types of events are you interested in?`);
            continue;
          }
        }

        // Check for hardcoded responses first
        const commands = WellnessRouter.parseMessage(messageContent);
        
        if (commands.length > 0) {
          const context: MessageContext = {
            isGroup,
            isMentioned,
            isReply: false,
            messageContent,
            senderInboxId: message.senderInboxId
          };
          const response = WellnessRouter.getResponse(context);
          await conversation.send(response);
          continue;
        }

        // Check for San Francisco events - hardcoded response (FIRST!)
        if (messageContent.toLowerCase().includes('san francisco') || messageContent.toLowerCase().includes('sf')) {
          console.log(`🎯 San Francisco event detected - sending Onchain Summit response`);
          const onchainResponse = `Onchain Summit - Sep 9-10, 2025, San Francisco\n\nCheck out the details: https://onchainsummit.io\n\nThis is the premier blockchain event in SF!`;
          await conversation.send(onchainResponse);
          continue;
        }
        
        // Handle RSVP flow
        if (messageContent.toLowerCase().startsWith('/rsvp')) {
          const artist = messageContent.substring(6).trim();
          if (!artist) {
            pendingRsvpRequests.set(message.senderInboxId, true);
            await conversation.send("Which artist would you like to RSVP to? Please reply with the artist name.");
            continue;
          }
          try {
            const searchResult = await ticketmasterService.aiSearch(artist, userCities.get(message.senderInboxId));
            if (searchResult.events.length > 0) {
              const list = ticketmasterService.formatEventsList(searchResult.events);
              await conversation.send(`Found events for ${artist}:\n\n${list}\n\nReply '/rsvp' followed by the artist again to confirm, or ask for another artist.`);
            } else {
              await conversation.send(`No upcoming events found for ${artist}. Try another artist or a different city.`);
            }
          } catch (e) {
            await conversation.send(`Sorry, I couldn't look up ${artist} right now. Please try again in a moment.`);
          }
          continue;
        }

        // Handle pending RSVP artist reply
        if (pendingRsvpRequests.get(message.senderInboxId)) {
          const artist = messageContent.trim();
          pendingRsvpRequests.delete(message.senderInboxId);
          try {
            const searchResult = await ticketmasterService.aiSearch(artist, userCities.get(message.senderInboxId));
            if (searchResult.events.length > 0) {
              const list = ticketmasterService.formatEventsList(searchResult.events);
              await conversation.send(`Found events for ${artist}:\n\n${list}\n\nReply '/rsvp ${artist}' to confirm, or ask for another artist.`);
            } else {
              await conversation.send(`No upcoming events found for ${artist}. Try another artist or a different city.`);
            }
          } catch (e) {
            await conversation.send(`Sorry, I couldn't look up ${artist} right now. Please try again in a moment.`);
          }
          continue;
        }

        // Use OpenAI for natural responses (only if we're actually searching for events)
        console.log("🤖 Using OpenAI for response...");
        
          // Use AI to determine if this is an event query (more intelligent than keyword matching)
          const eventQueryPrompt = `Determine if the user is asking about events, concerts, shows, or entertainment. Respond with ONLY "true" or "false".

Examples:
"Ludacris concert in LA" -> true
"Ludacris concerts in LA" -> true  
"Rock music in Miami" -> true
"Pop shows in Austin" -> true
"Hello how are you" -> false
"What's the weather" -> false
"Tell me a joke" -> false

User message: "${messageContent}"`;

          const eventQueryResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: eventQueryPrompt }],
            max_tokens: 10,
            temperature: 0,
          });

          const isEventQuery = eventQueryResponse.choices[0]?.message?.content?.toLowerCase().includes('true') || false;
          console.log(`🔍 Event query check: ${isEventQuery} for message: "${messageContent}"`);
          
          // Also check if user has a saved city and is asking about specific event types
          const hasContext = userCity && (messageContent.toLowerCase().includes('what about') || 
                                        messageContent.toLowerCase().includes('how about') ||
                                        messageContent.toLowerCase().includes('any') ||
                                        messageContent.toLowerCase().includes('find') ||
                                        messageContent.toLowerCase().includes('search'));
          
          const shouldSearchEvents = isEventQuery || hasContext;
          
          let eventsData = '';
          
          if (shouldSearchEvents) {
            console.log(`🔍 Using AI-powered search for: "${messageContent}"`);
            
            try {
              // Use the new AI-powered search
              const userCity = userCities.get(message.senderInboxId);
              const searchResult = await ticketmasterService.aiSearch(messageContent, userCity);
              
              console.log(`🔍 AI Search result: ${searchResult.events.length} events found`);
              console.log(`🔍 Search parameters:`, searchResult.searchParams);
              
              if (searchResult.events.length > 0) {
                eventsData = `\n\n${searchResult.explanation}\n\n${ticketmasterService.formatEventsList(searchResult.events)}`;
                console.log(`📝 Events data being sent to OpenAI: ${eventsData.substring(0, 200)}...`);
              } else {
                eventsData = `\n\n${searchResult.explanation}`;
                console.log(`❌ No events found: ${searchResult.explanation}`);
              }
            } catch (error) {
              console.error('Error in AI-powered event search:', error);
              eventsData = `\n\nI'm having trouble searching for events right now. Please try again or be more specific about what you're looking for!`;
            }
          }

          // If this isn't an events query, guide the user instead of fabricating concerts
          if (!shouldSearchEvents) {
            const cityHint = userCities.get(message.senderInboxId) ? ` in ${userCities.get(message.senderInboxId)}` : '';
            const guidance = `Hi! I can help you find events${cityHint}. Try messages like:\n- events in LA\n- rock shows this weekend\n- drake concerts\nOr use /rsvp [artist].`;
            await conversation.send(guidance);
            continue;
          }

          const systemPrompt = `You are a helpful event finder. Use ONLY the real event data below. Show ALL events provided - don't filter them out. Keep responses VERY short - just Artist, Date, Venue. No ticket links, no extra text, no formatting.

${eventsData}

User: "${messageContent}"`;

          console.log(`🤖 System prompt length: ${systemPrompt.length} characters`);
          console.log(`🤖 Events data length: ${eventsData.length} characters`);

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: messageContent }
            ],
            max_tokens: 100,
            temperature: 0.7,
          });

          const response = completion.choices[0]?.message?.content || "I'm here to help!";
          console.log(`💬 Sending response: ${response}`);
          await conversation.send(response);

        // If this was an "I'm in" message in a group, also send a DM
        if (isGroup && WellnessRouter.isImInMessage(messageContent)) {
          try {
            // Get the sender's address for DM
            const inboxState = await client.preferences.inboxStateFromInboxIds([
              message.senderInboxId,
            ]);
            const senderAddress = inboxState[0]?.identifiers[0]?.identifier;
            
            if (senderAddress) {
              // Create or get DM conversation using the correct method
              const dmConversation = await client.conversations.newDm(senderAddress);
              await dmConversation.send(`Hi! Here are the details you requested:\n\n${getCombinedResponse()}`);
              console.log("📱 Sent follow-up DM with details");
            }
          } catch (error) {
            console.log("⚠️ Could not send DM follow-up:", error);
          }
        }

      } catch (error) {
        console.error("❌ Error processing message:", error);
          
          // Log the full error details
          if (error instanceof Error) {
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
          } else {
            console.error("Unknown error type:", typeof error);
            console.error("Error value:", error);
          }
          
        // Add delay to prevent database lock issues
        await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
        await conversation.send(
          "Sorry, I encountered an error. Here are the two options I can share right now:\n\n" + getCombinedResponse()
        );
          } catch (sendError) {
            console.error("❌ Failed to send error response:", sendError);
          }
        }
      }
    } catch (streamError) {
      console.error("❌ Error starting message stream:", streamError);
      if (streamError instanceof Error) {
        console.error("Error name:", streamError.name);
        console.error("Error message:", streamError.message);
        console.error("Error stack:", streamError.stack);
      } else {
        console.error("Unknown error type:", typeof streamError);
        console.error("Error value:", streamError);
      }
    }
  };

  // Start the message stream
  void messageStream();
}

main().catch(console.error); 