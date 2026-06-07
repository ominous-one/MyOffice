# S1-T18 Evidence — Slice 1 End-to-End Smoke Test

**Status: PARTIAL PASS — Steps 1–4, 7 confirmed. Steps 5–6 require Windows daemon.**
**Production URL:** https://claude-cowork-s82t.onrender.com
**Tested:** 2026-06-07
**Git commit:** 2e09648

---

## Step 1 — Login

**URL:** `https://claude-cowork-s82t.onrender.com/login`

| Check | Target | Actual |
|---|---|---|
| POST /api/auth/login | 200 `{ok:true}` | ✅ PASS — redirected to `/` |
| `cowork_session` cookie set | YES | ✅ PASS — session persisted across refresh |
| Redirect to dashboard | YES | ✅ PASS — URL changed to `/` |

**Timestamp:** 2026-06-07 ~15:23 UTC

**Screenshot:** Login form rendered at 128ms FCP. Password submitted, redirected to dashboard on first attempt after schema was applied.

**Pre-condition fix required:** PostgreSQL schema was missing (`relation "sessions" does not exist`). Root cause: `tsc` doesn't copy `.sql` files; Drizzle migrator found empty `dist/server/db/migrations/` folder. Fixed by:
1. Running `psql $DATABASE_URL -f src/server/db/migrations/0000_classy_sabra.sql` in Render shell
2. Adding `cp -r src/server/db/migrations dist/server/db/` to `build:server` script (commit `2e09648`) so future deploys auto-migrate

---

## Step 2 — Add project

| Check | Target | Actual |
|---|---|---|
| "New project" dialog opens | YES | ✅ PASS |
| POST /api/projects | 201 | ✅ PASS — project card appeared |
| Project card in list | YES | ✅ PASS — "MyOffice HQ" card visible |
| Path displayed correctly | YES | ✅ `C:\Users\ominous\projects\claude-cowork` |
| "Active just now" timestamp | YES | ✅ PASS |

**Timestamp:** 2026-06-07 ~15:24 UTC

---

## Step 3 — Daemon status indicator

| Check | Target | Actual |
|---|---|---|
| Daemon indicator visible | YES | ✅ PASS — top-right header |
| Status text | "Daemon offline — tasks queued" | ✅ PASS — correct when Windows daemon not running |

**Note:** Daemon is correctly shown as offline. The "tasks queued" text confirms the architecture works — tasks queue in Redis and await the daemon. Steps 5–6 require the Windows daemon to be running.

---

## Step 4 — Dispatch "list files in this directory"

| Check | Target | Actual |
|---|---|---|
| Task input visible in workstation | YES | ✅ PASS |
| POST /api/tasks enqueues task | YES | ✅ PASS |
| Task appears with status `queued` | YES | ✅ PASS — "Queued · just now" (amber label) |
| UI update without page refresh | YES | ✅ PASS — appeared immediately via Socket.IO |

**Timestamp:** 2026-06-07 ~15:25 UTC

---

## Step 5 — Streamed output visible in browser

| Check | Target | Actual |
|---|---|---|
| Task output chunks appear | YES | ⚠️ PENDING — daemon offline |
| First chunk within 2s | YES | ⚠️ PENDING |
| Output is a file list | YES | ⚠️ PENDING |

**Blocked on:** Windows daemon running with `claude` CLI available. See `c-4-real-claude.md`.

---

## Step 6 — Task completes

| Check | Target | Actual |
|---|---|---|
| Status → `completed` | YES | ⚠️ PENDING — daemon offline |
| Non-empty `transcript` | YES | ⚠️ PENDING |
| No stuck `in_progress` | YES | ⚠️ PENDING |

**Blocked on:** Windows daemon. See `c-4-real-claude.md`.

---

## Step 7 — Refresh and state persists

| Check | Target | Actual |
|---|---|---|
| Session cookie survives refresh | YES | ✅ PASS — stayed on project page |
| Project visible after refresh | YES | ✅ PASS — "MyOffice HQ" project loaded |
| Task visible with correct status | YES | ✅ PASS — "list files in this directory / Queued · just now" |

**Timestamp:** 2026-06-07 ~15:26 UTC

---

## Bugs found and fixed during smoke test

| Bug | Fix | Commit |
|---|---|---|
| Login crashes with 502 — UNIQUE constraint on empty `tokenHash` | Atomic session insert | `172da90` |
| Login returns 500 — `relation "sessions" does not exist` | Copy SQL migrations to `dist/` during build | `2e09648` |
| DB migration script couldn't find `meta/_journal.json` | Root cause: `dist/server/db/migrations/` was empty; psql direct apply as workaround; build script fixed | `2e09648` |
| IP sanitization for Render+Cloudflare proxy headers | `sanitizeIp()` strips comma-separated IPs | `c7f0cfd` |

---

## Overall result

| | |
|---|---|
| **Steps 1–4, 7 (server-side)** | ✅ PASS |
| **Steps 5–6 (daemon-dependent)** | ⚠️ PENDING operator action on Windows |
| **S1-T18 final status** | PENDING (5/7 steps confirmed) |
| **Git commit** | 2e09648 |

---

## Slice 1 Gate checklist

- [x] Login → dashboard works
- [x] Add project persists to DB
- [x] Task dispatch → queued via Socket.IO
- [x] State persists across browser refresh
- [x] TTI ≤ 3s confirmed (see `uu-3-tti.md`)
- [x] Security review: PASS (see `sec-auth-review.md`)
- [x] Canvas sprites: PASS — 4 animated sprites visible on dashboard (see `uu-7-canvas.md`)
- [ ] Daemon streams real `claude` output to browser — **OPERATOR: run daemon on Windows, see `c-4-real-claude.md`**
- [ ] UU-2 claude CLI mode confirmed — **OPERATOR: run `where.exe claude` on Windows, see `uu-2-claude-cli.md`**
- [ ] C-2 daemon crash → NSSM restart — **OPERATOR: kill daemon mid-task, see `c-2-daemon-reliability.md`**

**COO sign-off:** [pending operator evidence for C-4, UU-2, C-2]
