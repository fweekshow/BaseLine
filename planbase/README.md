# PlanBase XMTP Bot

A smart XMTP agent that helps users find wellness activities and events using OpenAI integration.

## Features

- **🤖 OpenAI Integration** - Natural, contextual responses
- **🎯 Smart Response System** - Hardcoded responses for specific queries, OpenAI for complex topics
- **💬 Group & DM Support** - Works in both direct messages and group chats
- **🌐 Event Information** - Onchain Summit 2025 details with website links
- **💃 Wellness Activities** - Dance therapy sessions with Tash in Echo Park
- **💙 Empathetic Responses** - Handles sensitive topics appropriately

## Getting Started

### Prerequisites

- Node.js v20 or higher
- XMTP wallet and encryption keys
- OpenAI API key

### Environment Setup

Create a `.env` file in the root directory with:

```bash
WALLET_KEY=your_wallet_private_key_here
ENCRYPTION_KEY=your_encryption_key_here
XMTP_ENV=production
OPENAI_API_KEY=your_openai_api_key_here
```

### Installation

```bash
npm install
```

### Running the Bot

```bash
npm run dev
```

## How It Works

The bot uses a hybrid approach:

1. **🎯 Hardcoded Responses** - For specific keywords like "summit" or "onchain"
2. **🤖 OpenAI Responses** - For complex queries, sensitive topics, and natural conversation
3. **📱 Smart Context** - Only mentions wellness activities when relevant

## Event Information

- **Onchain Summit 2025** - August 21st-24th, 2025 in San Francisco, CA
- **Website**: https://www.onchainsummit.io
- **Dance Therapy** - Sessions with Tash in Echo Park (no website available)

## Response Examples

- "Tell me about the summit" → Detailed event info with link
- "What events are in LA?" → Natural response about available activities
- "I'm struggling with addiction" → Empathetic guidance (no wellness activities mentioned)

## Development

The bot automatically restarts when files change thanks to the `--watch` flag. 