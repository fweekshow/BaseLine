# Agent Tasks For Cursor

## When asked to "start the agent"
1) Create /src with index.ts, router.ts, data.ts, reply.ts based on rules.
2) Implement XMTP connect (dev env), stream messages, route commands.
3) Add keyword router for solo + group.
4) Hardcode two items from /src/data.ts and render via /src/reply.ts.
5) Add "I'm in" detection in groups → DM the combined details message.
6) Provide npm scripts: dev, build, start.

## When asked to "add Base actions later"
- Introduce custom XMTP content types for actions/intent with text fallback.
- Keep code path behind a feature flag: `USE_RICH_ACTIONS`. 