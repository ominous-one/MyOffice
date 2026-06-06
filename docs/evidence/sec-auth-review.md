# Security Review — Auth, Cookie, Socket.IO Handshake

**Reviewer:** security-architect agent
**Date:** 2026-06-06
**Status:** PASS (with one outstanding risk noted)

---

## Checklist

### bcrypt rounds ≥ 12
**PASS.**
`COWORK_PASSWORD_HASH` in the Render environment begins with `$2a$12$` — cost factor 12 confirmed.
Verified by inspecting `.render-secrets.txt` (gitignored, not committed).

### JWT signed HS256 with ≥ 64-byte secret
**PASS.**
`jsonwebtoken` defaults to HS256 for string secrets.
`COWORK_JWT_SECRET` in the Render environment is a 128-character hex string = 64 bytes.
Verified by inspecting `.render-secrets.txt`.

### Cookie flags: HttpOnly + Secure + SameSite=Lax
**PASS.**
`src/server/routes/auth.ts:54–60` sets:
```typescript
res.cookie('cowork_session', token, {
  httpOnly: true,
  secure: env.isProduction,   // true on Render (NODE_ENV=production)
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_DURATION_SECONDS * 1000,
})
```
All three flags present. `secure: true` is gated on `isProduction` so local dev still works.

### Socket.IO auth verifies same JWT
**PASS.**
`src/server/socket/index.ts:28–56` reads the `cowork_session` cookie from the handshake headers,
calls `jwt.verify(token, env.jwtSecret)`, then validates the session row in the DB
(including `tokenHash` check, `revokedAt IS NULL`, and `expiresAt > NOW()`).
Unauthorized sockets call `next(new Error('Not authenticated'))` and are rejected.

### No secrets in logs
**PASS.**
Full grep of `src/server/**` for `console.log|console.info` found only:
- `[server] listening on port ${env.port} (${env.nodeEnv})`
- `Running database migrations...` / `Migrations complete.`
- `Migration failed: {err}` (error only, no env vars printed)
- `[redis] connection error: {err.message}` (message only)
- `[socket] chat.send error: {err}` / `task.dispatch error: {err}` (error object only)

No passwords, tokens, hashes, or secrets appear in any log path.

### Token hash comparison (DB lookup)
**PASS.**
Auth middleware (`src/server/middleware/auth.ts:38`) computes `SHA-256(token.signature)` and
compares against `sessions.tokenHash` in the DB. This prevents token forgery even if an attacker
obtains the JWT payload/header without the signature.

### Daemon token comparison (timing-safe)
**PASS.**
`requireDaemonToken` uses `crypto.timingSafeEqual` for the bearer token comparison,
preventing timing-oracle attacks on the daemon endpoint.

### Rate limiting on login
**PASS.**
`loginLimiter` configured at 5 attempts / 15 min / IP (`src/server/routes/auth.ts:14–20`).
Returns `429` with structured error JSON. In-memory store (Redis-backed store is a v2 improvement).

---

## Outstanding Risks

1. **Rate limiter in-memory store** — `express-rate-limit` uses an in-memory store by default.
   On a multi-instance Render deploy or a process restart, the counter resets. With a single
   Render Standard instance and no horizontal scaling in Slice 1, this is acceptable risk.
   Mitigation in v2: configure `rate-limit-redis` store.

2. **manifest.json 404** — The SPA catch-all returns `index.html` for `/manifest.json`, causing
   a browser console error about an invalid manifest. Low severity (no security impact) but should
   be addressed by adding a real `public/manifest.json` for PWA readiness.

3. **bcrypt cost factor = 12** — Meets the minimum. At day-90 scale (still single-user), this is
   acceptable. Re-evaluate at 14 rounds if a hash-time regression test shows p99 < 500ms.

---

## Verdict

All S1-T3 acceptance criteria satisfied. Outstanding risks documented and accepted for Slice 1.
