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
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment from the main project directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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
const ticketmasterService = new TicketmasterService(TICKETMASTER_API_KEY);

// Simple in-memory storage for user cities (in production, use a database)
const userCities = new Map<string, string>();
const userAddresses = new Map<string, string>();
const pendingAddressRequests = new Set<string>();

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
        
        /* Ignore messages from the same agent or non-text messages */
        if (
          message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
          message.contentType?.typeId !== "text"
        ) {
          console.log("⏭️ Skipping message (from self or non-text)");
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

          // Handle city setting in solo chats
          if (!isGroup && messageContent.toLowerCase().includes('my city is') || messageContent.toLowerCase().includes('i live in')) {
            const cityMatch = messageContent.match(/(?:my city is|i live in)\s+([^.!?]+)/i);
            if (cityMatch) {
              const city = cityMatch[1].trim();
              userCities.set(message.senderInboxId, city);
              await conversation.send(`Got it! I'll remember you're in ${city}. How can I help you today?`);
              continue;
            }
          }

          // Handle city selection with Quick Actions
          if (!isGroup && (messageContent.toLowerCase().includes('change my city') || 
                           messageContent.toLowerCase().includes('set my city') ||
                           messageContent.toLowerCase().includes('where am i'))) {
            
                      console.log(`🔍 Checking city condition for: "${messageContent}"`);
            
            // Check if user is asking about their current city
            if (messageContent.toLowerCase().includes('what city') || messageContent.toLowerCase().includes('where am i')) {
              const currentCity = userCities.get(message.senderInboxId);
              if (currentCity) {
                await conversation.send(`You're currently set to: ${currentCity}`);
              } else {
                await conversation.send(`You haven't set a city yet. What city are you in?`);
              }
              return;
            }
            
            console.log(`✅ City condition matched! Sending Quick Actions.`);
            
            
            
            // Send user-friendly city selection message
            console.log("📝 Sending city selection message...");
            await conversation.send(`What city are you in? 

Choose from these options:
1. Los Angeles
2. San Francisco  
3. New York
4. Miami
5. Austin
6. Other City

Or just type "I live in [your city]" and I'll remember it!`);
            return; // Exit early to prevent multiple responses
          }

          // Handle address management - simple text input
          if (!isGroup && (messageContent.toLowerCase().includes('change my address') || 
                           messageContent.toLowerCase().includes('update address') || 
                           messageContent.toLowerCase().includes('my address'))) {
            
            const currentAddress = userAddresses.get(message.senderInboxId);
            if (currentAddress) {
              await conversation.send(`Your current address is: ${currentAddress}

To change it, just type "My address is [new address]"
To remove it, type "Remove my address"`);
            } else {
              await conversation.send(`You haven't set an address yet. Just type "My address is [your address]" and I'll remember it!`);
            }
            return; // Exit early to prevent multiple responses
          }

          // Handle address input when user is prompted
          if (!isGroup && pendingAddressRequests.has(message.senderInboxId)) {
            const address = messageContent.trim();
            if (address.length > 0) {
              userAddresses.set(message.senderInboxId, address);
              pendingAddressRequests.delete(message.senderInboxId);
              await conversation.send(`Perfect! I've saved your address: ${address}. How can I help you today?`);
              return;
            }
          }

          // Handle "My address is" input
          if (!isGroup && messageContent.toLowerCase().includes('my address is')) {
            const addressMatch = messageContent.match(/my address is\s+(.+)/i);
            if (addressMatch) {
              const address = addressMatch[1].trim();
              userAddresses.set(message.senderInboxId, address);
              await conversation.send(`Perfect! I've saved your address: ${address}. How can I help you today?`);
              return;
            }
          }

          // Handle "Remove my address"
          if (!isGroup && messageContent.toLowerCase().includes('remove my address')) {
            userAddresses.delete(message.senderInboxId);
            await conversation.send(`Your address has been removed.`);
            return;
          }

          // Handle city responses (when user types a city name)
          // Only treat as city response if it's clearly a standalone city mention
          if (!isGroup && (
            messageContent.toLowerCase().includes('i live in') ||
            messageContent.toLowerCase().includes('my city is') ||
            // Only treat as city response if it's a single word or simple city name
            (messageContent.toLowerCase().includes('los angeles') && messageContent.toLowerCase().trim().length <= 15 && !messageContent.toLowerCase().includes('events')) ||
            (messageContent.toLowerCase().includes('san francisco') && messageContent.toLowerCase().trim().length <= 15 && !messageContent.toLowerCase().includes('events')) ||
            (messageContent.toLowerCase().includes('new york') && messageContent.toLowerCase().trim().length <= 15 && !messageContent.toLowerCase().includes('events')) ||
            (messageContent.toLowerCase().includes('miami') && messageContent.toLowerCase().trim().length <= 15 && !messageContent.toLowerCase().includes('events')) ||
            (messageContent.toLowerCase().includes('austin') && messageContent.toLowerCase().trim().length <= 15 && !messageContent.toLowerCase().includes('events'))
          )) {
            console.log(`🔍 Checking city response: "${messageContent}"`);
            
            let selectedCity = '';
            
            // Map city names to standardized names
            if (messageContent.toLowerCase().includes('los angeles') || messageContent.toLowerCase().includes('la')) {
              selectedCity = 'Los Angeles';
            } else if (messageContent.toLowerCase().includes('san francisco') || messageContent.toLowerCase().includes('sf')) {
              selectedCity = 'San Francisco';
            } else if (messageContent.toLowerCase().includes('new york') || messageContent.toLowerCase().includes('nyc')) {
              selectedCity = 'New York';
            } else if (messageContent.toLowerCase().includes('miami')) {
              selectedCity = 'Miami';
            } else if (messageContent.toLowerCase().includes('austin')) {
              selectedCity = 'Austin';
            } else if (messageContent.toLowerCase().includes('i live in')) {
              // Extract city from "I live in [city]"
              const match = messageContent.match(/i live in\s+(.+)/i);
              if (match) {
                selectedCity = match[1].trim();
              }
            } else if (messageContent.toLowerCase().includes('my city is')) {
              // Extract city from "My city is [city]"
              const match = messageContent.match(/my city is\s+(.+)/i);
              if (match) {
                selectedCity = match[1].trim();
              }
            }
            
            if (selectedCity) {
              userCities.set(message.senderInboxId, selectedCity);
              console.log(`✅ City saved: ${selectedCity}`);
              await conversation.send(`Perfect! I'll remember you're in ${selectedCity}. How can I help you today?`);
              return;
            }
          }

          // Get user's city for context
          const userCity = userCities.get(message.senderInboxId) || 'your area';

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

          // Use OpenAI for natural responses
          console.log("🤖 Using OpenAI for response...");
          
          // Check if user is asking about events in a specific city
          const eventKeywords = ['events', 'concerts', 'shows', 'what\'s happening', 'whats happening', 'tickets', 'shows in', 'events in', 'concerts in', 'rock', 'jazz', 'pop', 'country', 'hip hop', 'rap', 'indie', 'folk', 'electronic', 'dance', 'comedy', 'theater', 'sports', 'basketball', 'football', 'baseball', 'soccer'];
          const isEventQuery = eventKeywords.some(keyword => messageContent.toLowerCase().includes(keyword));
          
          // Also check if user has a saved city and is asking about specific event types
          const hasContext = userCity && (messageContent.toLowerCase().includes('what about') || 
                                        messageContent.toLowerCase().includes('how about') ||
                                        messageContent.toLowerCase().includes('any') ||
                                        messageContent.toLowerCase().includes('find') ||
                                        messageContent.toLowerCase().includes('search'));
          
          const shouldSearchEvents = isEventQuery || hasContext;
          
          let eventsData = '';
          let cityForEvents = '';
          
                    if (shouldSearchEvents) {
            // Let OpenAI handle the natural language processing
            // Just pass the user's message and let it extract city/artist names
            console.log(`🔍 Processing event query: "${messageContent}"`);
            
            try {
              // For now, let's try a simple approach - search for events in major cities
              // and let OpenAI handle the interpretation
              const majorCities = ['Los Angeles', 'New York', 'San Francisco', 'Chicago', 'Miami', 'Austin', 'Detroit', 'Seattle'];
              
              // Check if any major city is mentioned in the message
              const mentionedCity = majorCities.find(city => 
                messageContent.toLowerCase().includes(city.toLowerCase()) ||
                messageContent.toLowerCase().includes(city.toLowerCase().replace(/\s+/g, ''))
              );
              
              // If no city mentioned in current message, check if user has a saved city
              const userCity = userCities.get(message.senderInboxId);
              const cityToSearch = mentionedCity || userCity;
              
              if (cityToSearch) {
                console.log(`🔍 Found city to search: ${cityToSearch} (${mentionedCity ? 'mentioned' : 'saved'})`);
                const dateRange = ticketmasterService.parseDateRange(messageContent);
                
                // Check for specific genre requests
                const genreKeywords = {
                  'rock': 'Rock',
                  'jazz': 'Jazz',
                  'pop': 'Pop',
                  'country': 'Country',
                  'hip hop': 'Hip-Hop/Rap',
                  'rap': 'Hip-Hop/Rap',
                  'indie': 'Indie',
                  'folk': 'Folk',
                  'electronic': 'Electronic',
                  'dance': 'Dance',
                  'comedy': 'Comedy',
                  'theater': 'Theater',
                  'sports': 'Sports',
                  'basketball': 'Sports',
                  'football': 'Sports',
                  'baseball': 'Sports',
                  'soccer': 'Sports'
                };
                
                let events: TicketmasterEvent[] = [];
                let genreFound = false;
                
                // Check if user is asking for a specific genre
                for (const [keyword, genre] of Object.entries(genreKeywords)) {
                  if (messageContent.toLowerCase().includes(keyword)) {
                    console.log(`🔍 Found genre request: ${genre}`);
                    events = await ticketmasterService.searchEventsByGenre(cityToSearch, genre, 5, dateRange.startDate, dateRange.endDate);
                    genreFound = true;
                    break;
                  }
                }
                
                // If no specific genre, search for all events
                if (!genreFound) {
                  events = await ticketmasterService.searchEventsByCity(cityToSearch, 5, dateRange.startDate, dateRange.endDate);
                }
                
                if (events.length > 0) {
                  eventsData = `\n\nEVENTS IN ${cityToSearch.toUpperCase()}:\n${ticketmasterService.formatEventsList(events)}`;
                } else {
                  eventsData = `\n\nNo events found in ${cityToSearch} for the requested time period.`;
                }
              } else {
                // Let OpenAI handle the response without specific event data
                eventsData = `\n\nI can help you find events! Try asking about specific cities like "Los Angeles", "New York", "San Francisco", etc.`;
              }
            } catch (error) {
              console.error('Error processing event query:', error);
              eventsData = `\n\nI'm having trouble fetching events right now. Try asking about a specific city!`;
            }
          }
          
          const systemPrompt = `You are a helpful wellness assistant that helps users discover events and concerts. You have access to real event data from Ticketmaster.

RESPONSE RULES:
- Be conversational and helpful
- When someone asks about events, use the real event data provided below
- Handle spelling variations and typos naturally (e.g., "Billie Eillish" → "Billie Eilish", "Los Angelas" → "Los Angeles")
- If no events are found, suggest they try a different city or time period
- If they ask about specific artists, mention if they have upcoming shows
- Keep responses natural and engaging
- Don't make up events you don't know about
- Be enthusiastic about helping people find great events!
- If someone mentions a city that's not in the data, suggest similar cities or ask for clarification

${eventsData}`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: messageContent }
            ],
            max_tokens: 150,
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