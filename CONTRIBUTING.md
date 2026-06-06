# Contributing — Claude Cowork HQ

## Branch naming

```
feat/<short-slug>       new features
fix/<short-slug>        bug fixes
refactor/<short-slug>   refactors (no behaviour change)
chore/<short-slug>      dependency bumps, config, tooling
docs/<short-slug>       docs-only changes
```

Never push directly to `main`. Open a PR against `main`; merge only when CI passes.

## Conventional commit prefixes

```
feat:      new user-facing capability
fix:       bug correction
refactor:  structural change, no behaviour delta
chore:     tooling, deps, config
docs:      documentation only
test:      test-only changes
perf:      measurable performance improvement
```

Example: `fix: atomic session insert — generate UUID+JWT before DB write`

## Lint and format

```bash
npm run lint          # eslint check
npm run lint:fix      # eslint auto-fix
npm run format        # prettier write
npm run format:check  # prettier check (CI uses this)
npm run typecheck     # tsc --noEmit (both server and client)
```

All four must pass before merging to `main`.

## No-merge rule

A PR is not merge-eligible if any of the following are true:

- `npm run lint` exits non-zero
- `npm run typecheck` exits non-zero
- A Render deploy preview (if configured) fails health check

## Local dev

```bash
docker compose up -d          # Postgres 16 + Redis
npm run dev                   # server (tsx watch) + client (vite)
```

Server: `http://localhost:3000` (also serves API)
Client: `http://localhost:5173` (Vite HMR)

## Environment variables

Copy `.env.example` to `.env` and fill in the required values.
Never commit `.env` or any file containing secrets.
