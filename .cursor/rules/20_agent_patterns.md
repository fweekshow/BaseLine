# XMTP Agent Patterns (Solo + Group)

## Must Support
- **DMs**: 1:1 conversations.
- **Groups**: respond when @mentioned or when a message starts with a command.

## Message Loop
- Stream inbound messages.
- Normalize to lowercase.
- Route by keywords: ["nearby", "event", "summit", "wellness", "dance"].
- If in a group and someone says "i'm in", send them a **DM** with details.

## Reliability
- Guard all network calls with try/catch.
- If anything fails, return a graceful fallback:
  "Here are the two options I can share right now…" (then print both items).

## Content Types
- MVP: **plain text** only.
- Later: Base's custom Quick Actions / Intent content types for buttons. (When you add them, keep a text fallback.) 