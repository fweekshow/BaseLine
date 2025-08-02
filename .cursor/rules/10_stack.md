# Stack & Project Conventions

## Runtime & Tooling
- Node.js v20+, Yarn v4+. 
- TypeScript strict mode, ESM or TS with ts-node.
- Lint with ESLint; format with Prettier.

## Packages
- "@xmtp/node-sdk" for agent.
- "dotenv" for env.
- "dayjs" (w/ timezone) for dates.

## Structure
/src
  index.ts        # boot, connect, stream messages
  router.ts       # parse commands + route (solo vs group)
/src/data.ts      # hardcoded provider + event
/src/reply.ts     # message builders (plain text MVP)

## Environment Vars (required)
OPENAI_API_KEY=...            # for future LLM use; OK to stub now
WALLET_KEY=0x...              # agent EOA private key
ENCRYPTION_KEY=...            # xmtp local db key
XMTP_ENV=dev                  # dev | production
PORT=3000

## Do Nots
- Do not commit .env.
- Do not print WALLET_KEY or message bodies in logs. 