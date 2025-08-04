import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, Group, type XmtpEnv } from "@xmtp/node-sdk";
import OpenAI from "openai";
import { WellnessRouter, type MessageContext } from './router.js';
import { getCombinedResponse } from './data.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
      console.log(
        `📨 Received: "${messageContent}" from ${message.senderInboxId}`,
      );

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
        
        // Check if this is a reply to our message
        const isReply = message.replyTo !== undefined;

        const context: MessageContext = {
          isGroup,
          isMentioned,
          isReply,
          messageContent,
          senderInboxId: message.senderInboxId
        };

        // Check if we should respond
        if (!WellnessRouter.shouldRespond(context)) {
          console.log("⏭️ Skipping message (not mentioned in group)");
          continue;
        }

        // Send a quick reaction to show we're processing
        try {
          await conversation.send("👀", { contentType: "xmtp.org/reaction:1.0" });
        } catch (error) {
          console.log("⚠️ Could not send reaction (not supported)");
        }

        let response: string;

        // Check if this is a simple command we can handle directly
        const commands = WellnessRouter.parseMessage(messageContent);
        if (commands.length > 0) {
          // Use our hardcoded responses for known commands
          response = WellnessRouter.getResponse(context);
          console.log(`🎯 Using hardcoded response for command: ${commands.join(', ')}`);
        } else {
          // Use OpenAI for more complex queries
          console.log("🤖 Using OpenAI for response...");
          const completion = await openai.chat.completions.create({
            messages: [
              {
                role: "system",
                content: `You are a wellness concierge agent for Base App. You help users find wellness activities and events. 

Available information:
- Dance therapy sessions with Tash in Echo Park (no website available)
- Onchain Summit 2025: August 21st-24th, 2025 in San Francisco, CA
- Onchain Summit website: https://www.onchainsummit.io
- Onchain Summit tickets: https://www.onchainsummit.io (tickets available on the website)

IMPORTANT: Only mention these specific activities when the user is actually asking about wellness activities or events. If someone is dealing with serious issues like addiction, mental health, or personal struggles, respond with empathy and appropriate guidance without mentioning these specific activities unless directly relevant.

When mentioning events or activities, provide a natural response first, then include the link on a separate line like this:
"Here's the link: https://www.onchainsummit.io"

IMPORTANT: Only provide links when they actually exist. For dance therapy sessions, mention them but don't provide a link since none is available. Only provide the Onchain Summit link when specifically asking about that event.

Keep responses friendly, concise, and action-oriented. If someone asks about wellness activities, mention the dance therapy. If they ask about events, mention the summit. If they ask for links or tickets, provide the website URL. Always be helpful and encouraging.`
              },
              { role: "user", content: messageContent }
            ],
            model: "gpt-4o-mini",
            max_tokens: 200,
          });

          response = completion.choices[0]?.message?.content || 
                    "I'm here to help you find wellness activities! Try asking about 'nearby' options, 'wellness' sessions, or upcoming 'events'.";
        }

        console.log(`💬 Sending response: ${response.substring(0, 100)}...`);
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
              // Create or get DM conversation
              const dmConversation = await client.conversations.newConversation(senderAddress);
              await dmConversation.send(`Hi! Here are the details you requested:\n\n${getCombinedResponse()}`);
              console.log("📱 Sent follow-up DM with details");
            }
          } catch (error) {
            console.log("⚠️ Could not send DM follow-up:", error);
          }
        }

      } catch (error) {
        console.error("❌ Error processing message:", error);
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