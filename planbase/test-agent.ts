import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "./helpers/client.js";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import fs from 'fs';

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY", 
  "XMTP_ENV",
]);

async function main() {
  console.log("🚀 Starting simple test agent...");
  
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  console.log("📡 Creating XMTP client...");
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  console.log("✅ XMTP client created successfully");
  logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();
  console.log("✅ Conversations synced successfully");

  console.log("🤖 Test agent is listening...");
  const stream = client.conversations.streamAllMessages();
  console.log("📡 Message stream started, waiting for messages...");
  
  for await (const message of await stream) {
    console.log(`📨 Raw message received: ${message.content} from ${message.senderInboxId}`);
    console.log(`📨 Message timestamp: ${message.sentAt}`);
    console.log(`📨 Conversation ID: ${message.conversationId}`);
    
    // Ignore messages from self
    if (message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      console.log("⏭️ Skipping message from self");
      continue;
    }

    // Only process text messages
    if (message.contentType?.typeId !== "text") {
      console.log("⏭️ Skipping non-text message");
      continue;
    }

    const messageContent = message.content as string;
    console.log(`🔍 Processing message: "${messageContent}"`);
    
    // Log to file
    const logMessage = `[${new Date().toISOString()}] 📨 Received: "${messageContent}" from ${message.senderInboxId}`;
    fs.appendFileSync('test-logs.txt', logMessage + '\n');
    
    // Get conversation
    const conversation = await client.conversations.getConversationById(message.conversationId);
    if (!conversation) {
      console.log("❌ Unable to find conversation");
      continue;
    }

    // Send simple response
    try {
      const response = `Test agent received: "${messageContent}"`;
      console.log(`💬 Sending response: ${response}`);
      await conversation.send(response);
      console.log("✅ Response sent successfully");
    } catch (error) {
      console.error("❌ Error sending response:", error);
    }
  }
}

main().catch(console.error); 