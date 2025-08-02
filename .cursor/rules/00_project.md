# Project: Wellness Connections (Base App Chat Agent)

## Mission
A wallet-native AI concierge you can chat with solo or in a Base XMTP **group**. It finds nearby activities and (for demo) returns:
1) **Bianca's Flow — Dance Therapy** (provider)
2) **Onchain Summit: LA Edition** (event)
Later it will book and expand sources.

## Non-Negotiables
- Use **XMTP Node SDK** for messaging; support DMs **and groups**.
- Minimal dependencies; Node 20+, Yarn 4+. 
- Keep PHI off-chain. Do **not** log sensitive content.
- Start on **XMTP dev** network; env-gated. 
- Reply fast; degrade to plain text if rich content isn't supported.

## Commands (MVP)
- `nearby [city|zip]?` → returns the two hardcoded items.
- `wellness` or `dance` → returns Bianca's Flow.
- `event` or `summit` → returns Onchain Summit.
- In groups: detect "I'm in" → DM details + (optional) reminder.

## Output Style
- Short, friendly, action-first.
- Plain text now; buttons/actions later. 