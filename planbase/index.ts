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
      
      // Also log to file
      fs.appendFileSync('bot-logs.txt', logMessage + '\n');

      /* Get the conversation from the local db */
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      /* If the conversation is not found, skip the message */
      if (!conversation) {
        console.log("❌ Unable to find conversation, skipping");
        continue;
      }

      try {
        // Determine if this is a group conversation (following XMTP SDK patterns)
        const isGroup = conversation instanceof Group;
        
        // Get agent's address for mention detection
        const agentAddress = client.accountIdentifier?.identifier;
        
        // Check if agent is mentioned (for group chats) - look for @mentions of agent's address or common names
        const isMentioned = isGroup && (
          messageContent.toLowerCase().includes('@wellness') || 
          messageContent.toLowerCase().includes('@wellnessconnections') ||
          messageContent.toLowerCase().includes('@wellnessagent') ||
          messageContent.toLowerCase().includes('@agent') ||
          (agentAddress && messageContent.toLowerCase().includes(agentAddress.toLowerCase())) ||
          messageContent.toLowerCase().includes('@planbase.base.eth') // User's basename
        );
        
        // Only respond in solo chats or if mentioned in groups
        if (isGroup && !isMentioned) {
          continue;
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

        // Check for simple greetings - respond with simple format
        const simpleGreetings = ['hey', 'hi', 'hello', 'sup', 'whats up', 'yo'];
        if (simpleGreetings.some(greeting => messageContent.toLowerCase().includes(greeting))) {
          const response = "Artist, Date, Venue";
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
        
        // Use OpenAI for natural responses
        console.log("🤖 Using OpenAI for response...");
        
        // Use AI to determine if this is an event query (more intelligent than keyword matching)
        const eventQueryPrompt = `Determine if the user is asking about events, concerts, shows, or entertainment. Respond with ONLY "true" or "false".

Examples:
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
            
            if (searchResult.events.length > 0) {
              eventsData = `\n\n${searchResult.explanation}\n\n${ticketmasterService.formatEventsList(searchResult.events)}`;
            } else {
              eventsData = `\n\n${searchResult.explanation}`;
            }
          } catch (error) {
            console.error('Error in AI-powered event search:', error);
            eventsData = `\n\nI'm having trouble searching for events right now. Please try again or be more specific about what you're looking for!`;
          }
        }
        
        const systemPrompt = `You are a helpful event finder. Use ONLY the real event data below. Show ALL events provided - don't filter them out. Keep responses VERY short - just Artist, Date, Venue. No ticket links, no extra text, no formatting.

${eventsData}

User: "${messageContent}"`;

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