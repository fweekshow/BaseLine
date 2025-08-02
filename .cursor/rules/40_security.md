# Security & Privacy

- Treat wallet addresses + location as sensitive.
- Never echo back raw env values.
- Avoid logging message content; log only metadata needed for debugging (conversation id, command, success/failure).
- No PHI; no on-chain writes of user data.
- Keep keys in .env; use secret manager in production. 