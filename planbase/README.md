# Planbase Agent

A clean XMTP agent for wellness connections and event discovery.

## Quick Start

```bash
# Install dependencies
npm install

# Start the agent
npm start

# For development with auto-restart
npm run dev
```

## Environment Variables

Create a `.env` file with:

```bash
WALLET_KEY=your_private_key
ENCRYPTION_KEY=your_encryption_key
OPENAI_API_KEY=your_openai_key
TICKETMASTER_API_KEY=your_ticketmaster_key
XMTP_ENV=production
```

## Features

- Wellness activity recommendations
- Event discovery via Ticketmaster
- Group and DM conversation support
- OpenAI-powered responses

## Production

The agent runs on xmtp.chat (production network) and responds to:
- Wellness-related queries
- Event searches
- Location-based recommendations 