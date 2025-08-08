import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "./helpers/client.js";
import { Client, Group, type XmtpEnv, ContentTypeId } from "@xmtp/node-sdk";
import OpenAI from "openai";
import { EventRouter, type MessageContext } from './router.js';
import { getCombinedResponse } from './data.js';
import { TicketmasterService, type TicketmasterEvent } from './helpers/ticketmaster.js';
import { DataManager } from './data-manager.js';
import { MessageProcessor } from './message-processor.js';

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

/* Initialize the Data Manager for structured data storage */
const dataManager = new DataManager('./data');

/* Initialize the Message Processor */
const messageProcessor = new MessageProcessor(dataManager, ticketmasterService, openai);

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


  
  // Define Base App content type strings
  const ACTIONS_CONTENT_TYPE = "coinbase.com/actions:1.0";
  const INTENT_CONTENT_TYPE = "coinbase.com/intent:1.0";
  
  // Send Quick Actions exactly as Base App expects
  const sendQuickActions = async (conversation: any, quickActionSet: any) => {
    try {
      // Create the actions content with proper structure exactly as Base docs specify
      const actionsContent = {
        id: quickActionSet.id,
        description: quickActionSet.description,
        actions: quickActionSet.actions,
        expiresAt: quickActionSet.expiresAt.toISOString()
      };
      
      // Send the JSON directly - Base App should detect and render as buttons
      await conversation.send(JSON.stringify(actionsContent));
      console.log("✅ Sent Quick Actions as JSON for Base App");
    } catch (error) {
      console.log("❌ Failed to send Quick Actions, falling back to text");
      // Fallback to structured text
      const fallbackMessage = `${quickActionSet.description}

[QUICK ACTIONS]
${quickActionSet.actions.map((action: any, index: number) => 
  `${index + 1}. ${action.label} (${action.style})`
).join('\n')}

Reply with the number to select!`;
      await conversation.send(fallbackMessage);
    }
  };
  
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
      
      // Only process text and XIP-67 content types
      if (message.contentType?.typeId !== "text" && 
          message.contentType?.typeId !== ACTIONS_CONTENT_TYPE &&
          message.contentType?.typeId !== INTENT_CONTENT_TYPE) {
          console.log("⏭️ Skipping message (not supported content type)");
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
      
      // Handle XIP-67 Intent content types and prefixed messages
      if (message.contentType?.typeId === INTENT_CONTENT_TYPE || messageContent.startsWith('XIP-67-INTENT:')) {
        try {
          let intentData;
          if (messageContent.startsWith('XIP-67-INTENT:')) {
            intentData = JSON.parse(messageContent.replace('XIP-67-INTENT:', ''));
          } else {
            intentData = JSON.parse(messageContent);
          }
          console.log(`🎯 Received XIP-67 Intent: ${intentData.actionId}`);
          
          // Simple RSVP handling
          if (intentData.actionId && intentData.actionId.startsWith('rsvp_')) {
            const action = intentData.actionId.replace('rsvp_', '');
            await conversation.send(`RSVP recorded: ${action}! Thanks for letting us know.`);
            continue;
          }
        } catch (e) {
          console.log("⚠️ Failed to parse XIP-67 Intent");
        }
      }

      try {
        // Use the new structured message processor
        const response = await messageProcessor.processMessage(message, conversation);
        
        // Send the response
        await conversation.send(response.content);
        
        // Handle Quick Actions if present
        if (response.quickActions) {
          await sendQuickActions(conversation, response.quickActions);
        }
        
        // Handle DM follow-up if needed
        if (response.shouldSendDM && response.dmContent) {
          try {
            const inboxState = await client.preferences.inboxStateFromInboxIds([
              message.senderInboxId,
            ]);
            const senderAddress = inboxState[0]?.identifiers[0]?.identifier;
            
            if (senderAddress) {
              const dmConversation = await client.conversations.newDm(senderAddress);
              await dmConversation.send(response.dmContent);
              console.log("📱 Sent follow-up DM");
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