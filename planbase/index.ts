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
const { WALLET_KEY, ENCRYPTION_KEY, OPENAI_API_KEY, XMTP_ENV } =
  validateEnvironment([
    "WALLET_KEY",
    "ENCRYPTION_KEY",
    "OPENAI_API_KEY",
    "XMTP_ENV",
  ]);

/* Initialize the OpenAI client */
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Simple in-memory storage for user cities (in production, use a database)
const userCities = new Map<string, string>();
const userAddresses = new Map<string, string>();
const pendingAddressRequests = new Set<string>();

/**
 * Main function to run the Wellness Connections agent
 */
async function main() {
  /* Create the signer using viem and parse the encryption key for the local db */
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  void logAgentDetails(client);

  /* Sync the conversations from the network to update the local db */
  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  // Stream all messages for wellness responses
  const messageStream = async () => {
    console.log("🤖 Wellness Connections agent is listening...");
    const stream = client.conversations.streamAllMessages();
    for await (const message of await stream) {
      /* Ignore messages from the same agent or non-text messages */
      if (
        message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
        message.contentType?.typeId !== "text"
      ) {
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
        if (!isGroup && (
          messageContent.toLowerCase().includes('i live in') ||
          messageContent.toLowerCase().includes('my city is') ||
          (messageContent.toLowerCase().includes('los angeles') && !messageContent.toLowerCase().includes('events')) ||
          (messageContent.toLowerCase().includes('san francisco') && !messageContent.toLowerCase().includes('events')) ||
          (messageContent.toLowerCase().includes('new york') && !messageContent.toLowerCase().includes('events')) ||
          (messageContent.toLowerCase().includes('miami') && !messageContent.toLowerCase().includes('events')) ||
          (messageContent.toLowerCase().includes('austin') && !messageContent.toLowerCase().includes('events'))
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
        
        const systemPrompt = `You are a helpful wellness assistant that guides users to discover events in their city.

EVENT DATABASE:
- San Francisco: Onchain Summit 2025 (August 21st-24th) - Website: https://www.onchainsummit.io, Tickets: https://www.onchainsummit.io/2025tickets
- Los Angeles: Dance therapy sessions with Tash in Echo Park (no website available)

RESPONSE RULES:
- For greetings or general questions, guide them to ask about events: "Hi! Ask me about events in your city!"
- When someone asks about events in any city, respond naturally about what's available
- If they ask about SF, mention the Onchain Summit and send the main website URL on its own line: https://www.onchainsummit.io
- If they ask about LA, mention the dance therapy sessions
- When someone asks for ticket links or tickets, send ONLY the ticket URL as plain text: https://www.onchainsummit.io/2025tickets
- Do NOT send both links in the same response
- For other cities, say you don't have current events listed for that area
- Keep responses friendly and conversational
- Don't make up events you don't know about

Guide users to discover events in their area!`;

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
        // Add delay to prevent database lock issues
        await new Promise(resolve => setTimeout(resolve, 1000));
        await conversation.send(
          "Sorry, I encountered an error. Here are the two options I can share right now:\n\n" + getCombinedResponse()
        );
      }
    }
  };

  // Start the message stream
  void messageStream();
}

main().catch(console.error); 