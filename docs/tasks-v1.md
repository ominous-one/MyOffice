# Claude Cowork HQ — Tasks v1

**Status:** Sequenced, ready for execution
**Date:** 2026-06-05
**Author:** COO
**Source documents:** `discovery-2026-06-05.md`, `requirements-2026-06-05.md`, `prd-v1.md`, `architecture.md`
**Hands to:** engineering-backend-architect, engineering-frontend-developer, engineering-database-optimizer, engineering-devops-automator, engineering-sre, security-architect

---

## How to read this document

- Slices ship in order. A slice does not start until the prior slice's acceptance tests pass.
- Hour ranges are honest, not optimistic. Lower bound assumes no surprises; upper bound assumes one realistic snag per task.
- Owner = the subagent that owns the work, not the only one who touches it.
- Acceptance test = one sentence that determines done. If the test isn't green, the task isn't done.
- "Blocks" = tasks that cannot start until this one is acceptance-test green.
- Every slice ends with a slice acceptance gate. The COO blocks progression until the gate is green.

---

## Slice 0 — Project setup and risk de-risking (target: 2 days)

Goal: every developer-environment surface is ready, and every architecture unknown that blocks Slice 1 has been verified or has a confirmed fallback.

### S0-T1 — Create GitHub repo and base TypeScript scaffold
- **Owner:** engineering-devops-automator
- **Blocks:** S0-T2, S0-T3, S0-T4, S0-T5, S1-*
- **Depends on:** —
- **Hours:** 2–3h
- **Acceptance test:** Repo `claude-cowork` exists on GitHub with `main` branch protected, `package.json`, `tsconfig.json`, `.gitignore`, and a passing `npm run lint` on an empty commit.

### S0-T2 — Bootstrap Vite + React 19 + Tailwind + Radix frontend shell
- **Owner:** engineering-frontend-developer
- **Blocks:** S1-T6, S1-T7, S1-T8
- **Depends on:** S0-T1
- **Hours:** 3–4h
- **Acceptance test:** `npm run dev` serves an empty React 19 app at localhost, Tailwind class `bg-red-500` renders red, one Radix primitive (Dialog) renders.

### S0-T3 — Bootstrap Express + Socket.IO + Drizzle backend shell
- **Owner:** engineering-backend-architect
- **Blocks:** S1-T2, S1-T3, S1-T4, S1-T5
- **Depends on:** S0-T1
- **Hours:** 3–4h
- **Acceptance test:** `npm run server` boots Express on a port, `/api/health` returns 200, Socket.IO connects from a node client, Drizzle connects to a local Postgres and runs an empty `SELECT 1`.

### S0-T4 — Local dev environment: docker-compose with Postgres 16 + Redis
- **Owner:** engineering-devops-automator
- **Blocks:** S0-T3 (only the DB/Redis portion), S1-T2, S1-T3
- **Depends on:** S0-T1
- **Hours:** 2–3h
- **Acceptance test:** `docker compose up` brings up Postgres 16 with AOF Redis; both reachable from the host on documented ports; READMEd in `/README.md`.

### S0-T5 — Render blueprint (`render.yaml`) and first deploy of the empty shell
- **Owner:** engineering-devops-automator
- **Blocks:** S1-T11, all post-Slice-1 deploys
- **Depends on:** S0-T2, S0-T3
- **Hours:** 3–5h
- **Acceptance test:** `render.yaml` from architecture §8 commits; merging to `main` deploys the shell to `cowork.lotview.ai` (or `claude-cowork.onrender.com`) and `/api/health` returns 200 from public internet within 5 minutes of merge.

### S0-T6 — UU-2 verification: `claude` CLI native on Windows vs WSL
- **Owner:** engineering-devops-automator
- **Blocks:** S1-T12, S1-T13, S1-T14 (entire daemon implementation)
- **Depends on:** —
- **Hours:** 1–2h
- **Acceptance test:** Documented in `/docs/evidence/uu-2-claude-cli.md`: output of `where claude`, `claude --version`, and `claude -p "hello"` from plain PowerShell on the operator's actual Windows machine. Decision recorded: `executor: "native"` or `executor: "wsl"`. If WSL, the spawn args and CWD translation rule are written down.

### S0-T7 — UU-7 visual spike: 4 CSS-animated sprites in a `.office-floor` div
- **Owner:** engineering-frontend-developer
- **Blocks:** S3-T1 (the canvas build)
- **Depends on:** S0-T2
- **Hours:** 1–2h
- **Acceptance test:** A standalone route `/spike/office` renders 4 absolutely-positioned divs with `steps(2)` keyframe breathing animation. Operator reviews and writes one sentence in `/docs/evidence/uu-7-canvas.md`: "feels alive enough" or "escalate to PixiJS."

### S0-T8 — Decide and document repo conventions: lint, format, commit, branch
- **Owner:** engineering-devops-automator
- **Blocks:** none (process)
- **Depends on:** S0-T1
- **Hours:** 1–2h
- **Acceptance test:** `/CONTRIBUTING.md` exists describing branch naming, conventional commit prefix, lint/format commands, and the rule "no merge to main without green CI."

### Slice 0 acceptance gate
- All 8 tasks green.
- An empty React shell is live on Render.
- UU-2 (claude CLI mode) and UU-7 (canvas feel) have written verdicts.
- COO writes a one-line "Slice 0 green — Slice 1 starts" note to begin Slice 1.

**Slice 0 total: 16–25 hours.**

---

## Slice 1 — Proof-of-architecture (target: end of week 1)

Goal: login → add project → daemon online indicator → dispatch task → real `claude` child process runs → stdout streams to browser → task persists on refresh. Every load-bearing piece of the architecture is exercised end-to-end.

### S1-T1 — Drizzle schema: full v1 DDL migration
- **Owner:** engineering-database-optimizer
- **Blocks:** S1-T2, S1-T3, S1-T4, S1-T5, S1-T12
- **Depends on:** S0-T3, S0-T4
- **Hours:** 4–6h
- **Acceptance test:** Architecture §3 DDL (all 9 tables, all enums, all indexes including the `briefing_generations` partial unique index) materialized as Drizzle migrations; `npm run db:migrate` applies cleanly to fresh local Postgres; `npm run db:reset` rolls back cleanly.

### S1-T2 — Auth: single-password login → JWT cookie + session row
- **Owner:** engineering-backend-architect
- **Blocks:** S1-T3, S1-T6, S1-T11
- **Depends on:** S1-T1
- **Hours:** 4–6h
- **Acceptance test:** POST `/api/auth/login` with the env-configured password returns 200, sets HttpOnly Secure cookie, writes a `sessions` row; subsequent authenticated REST call succeeds; wrong password returns 401; rate limit of 5/15min/IP enforced via Redis.

### S1-T3 — Security review: auth + cookie + Socket.IO handshake
- **Owner:** security-architect
- **Blocks:** S1-T11 (production deploy of Slice 1)
- **Depends on:** S1-T2, S1-T6
- **Hours:** 2–3h
- **Acceptance test:** Written review in `/docs/evidence/sec-auth-review.md` confirms: bcrypt rounds ≥12, JWT signed HS256 with 64-byte secret, cookie flags HttpOnly+Secure+SameSite=Lax, Socket.IO `cookie` auth verifies same JWT, no secrets in logs. Outstanding risks listed.

### S1-T4 — Project registry: add/list/edit/soft-delete REST endpoints
- **Owner:** engineering-backend-architect
- **Blocks:** S1-T7, S1-T12
- **Depends on:** S1-T1, S1-T2
- **Hours:** 4–6h
- **Acceptance test:** `POST /api/projects`, `GET /api/projects`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id` (soft-delete) work with cookie auth; `local_path` is rejected on edit (immutable); deleted projects do not appear in default list; integration tests cover all four.

### S1-T5 — Task model + BullMQ enqueue endpoint
- **Owner:** engineering-backend-architect
- **Blocks:** S1-T9, S1-T13, S1-T14
- **Depends on:** S1-T1, S1-T4
- **Hours:** 4–6h
- **Acceptance test:** `POST /api/tasks` writes a `task` row with status `queued` and pushes a BullMQ job; job is visible in Redis; integration test asserts both DB row and Redis job side effects.

### S1-T6 — Login page + auth-aware app shell + protected route guard
- **Owner:** engineering-frontend-developer
- **Blocks:** S1-T7, S1-T8, S1-T9
- **Depends on:** S0-T2, S1-T2
- **Hours:** 3–4h
- **Acceptance test:** Unauthenticated visit to any app route redirects to `/login`; correct password POSTs and lands on `/` with cookie set; refreshing keeps the session; logout button clears the cookie and revokes the server-side session.

### S1-T7 — Add-project form + empty-state for zero projects
- **Owner:** engineering-frontend-developer
- **Blocks:** S1-T8, S1-T9
- **Depends on:** S1-T4, S1-T6
- **Hours:** 3–4h
- **Acceptance test:** With zero projects, dashboard shows "Add your first project" CTA (no fabricated demo workstations — C-3). Submitting the form with valid fields creates a project; invalid path errors inline; project appears in list within 1s without a manual refresh.

### S1-T8 — Project workstation skeleton (single card, no canvas, no four-panel)
- **Owner:** engineering-frontend-developer
- **Blocks:** S1-T9
- **Depends on:** S1-T7
- **Hours:** 2–3h
- **Acceptance test:** Tapping a project from the dashboard opens a minimal workstation page showing project name, local path, status, and a task dispatch input + task list panel. No four-panel layout (that's Slice 3).

### S1-T9 — Frontend task dispatch + task list rendering
- **Owner:** engineering-frontend-developer
- **Blocks:** S1-T14
- **Depends on:** S1-T5, S1-T8
- **Hours:** 3–4h
- **Acceptance test:** Typing a prompt and submitting creates a task that appears in the task list within 1s with status `queued`; status transitions to `in_progress` and `completed` are reflected live via Socket.IO; empty task list shows an empty-state message, not fabricated rows (C-3).

### S1-T10 — Socket.IO server: rooms, auth middleware, task event emitters
- **Owner:** engineering-backend-architect
- **Blocks:** S1-T9, S1-T14, S1-T15
- **Depends on:** S0-T3, S1-T2, S1-T5
- **Hours:** 4–6h
- **Acceptance test:** Socket connects with valid cookie only; client joining `project:{id}` receives `task.queued`, `task.started`, `task.output`, `task.completed` events when server emits them; an unauthorized socket is disconnected on handshake.

### S1-T11 — Render production env: secrets, DB migrate on deploy
- **Owner:** engineering-devops-automator
- **Blocks:** S1-T16 (slice end-to-end test)
- **Depends on:** S0-T5, S1-T1, S1-T3
- **Hours:** 3–5h
- **Acceptance test:** Render dashboard has `COWORK_PASSWORD_HASH`, `COWORK_JWT_SECRET`, `COWORK_DAEMON_TOKEN`, `ANTHROPIC_API_KEY` set; deploy runs migrations before start; logging into the deployed URL with the real password works.

### S1-T12 — Windows daemon: skeleton, Redis connect, heartbeat
- **Owner:** engineering-backend-architect
- **Blocks:** S1-T13, S1-T14
- **Depends on:** S0-T6, S1-T1, S1-T5
- **Hours:** 5–7h
- **Acceptance test:** Daemon binary boots from `daemon.toml`, opens TLS Redis connection, writes `daemon:heartbeat:{id}` with TTL 60s every 30s, POSTs heartbeat row to `/api/daemon/heartbeat`; HQ UI shows green "daemon online" indicator within 30s of daemon start; turning daemon off flips indicator to "offline" within 60s.

### S1-T13 — Daemon task popper: BullMQ consumer, status PATCH lifecycle
- **Owner:** engineering-backend-architect
- **Blocks:** S1-T14
- **Depends on:** S1-T12
- **Hours:** 4–6h
- **Acceptance test:** With daemon online, dispatching a task causes daemon to pop the job within 5s, PATCH task to `in_progress`, simulate work (sleep 2s), PATCH to `completed`. End-to-end visible in HQ UI without `claude` yet wired in.

### S1-T14 — Daemon spawns real `claude` child process, streams stdout/stderr (HIGHEST RISK)
- **Owner:** engineering-backend-architect
- **Blocks:** S1-T16
- **Depends on:** S1-T13, S0-T6
- **Hours:** 6–10h
- **Acceptance test:** Dispatching prompt "list files in this directory" against a real project path spawns a real `claude` child process (native or WSL per S0-T6 verdict) in the correct `cwd`, child PID is logged by daemon, stdout chunks reach browser via Redis pub/sub → Socket.IO `task.output` within 2s of emission, child exit writes final `completed` status + full transcript to DB. Evidence stored in `/docs/evidence/c-4-real-claude.md`: PID, captured stdout chunks (timestamps), final task row JSON. C-4 satisfied.

### S1-T15 — PowerShell installer + NSSM service for daemon
- **Owner:** engineering-devops-automator
- **Blocks:** S1-T16
- **Depends on:** S1-T12
- **Hours:** 4–6h
- **Acceptance test:** Running `install.ps1` on a fresh Windows user account downloads the daemon binary, writes `daemon.toml`, installs and starts NSSM service `ClaudeCoworkDaemon`, verifies first heartbeat reaches HQ within 60s. Re-running installer is idempotent.

### S1-T16 — Daemon reliability: crash → restart, no silent task drop
- **Owner:** engineering-sre
- **Blocks:** Slice 1 acceptance gate
- **Depends on:** S1-T14, S1-T15
- **Hours:** 4–6h
- **Acceptance test:** `kill -9` daemon mid-task; NSSM restarts daemon within 10s; the in-flight task ends in `failed` with `reason='daemon_restart'` (never stuck `in_progress`) within 60s. UU-4 verified: BullMQ stalled-job recovery confirmed. Server-side reaper cron runs every 60s and forces orphaned `in_progress` tasks to `failed`. Evidence written to `/docs/evidence/c-2-daemon-reliability.md`.

### S1-T17 — Cost monitoring foundation
- **Owner:** engineering-backend-architect
- **Blocks:** Slice 2 (cannot ship Jarvis without this)
- **Depends on:** S1-T1
- **Hours:** 2–3h
- **Acceptance test:** `briefing_generations` table is present with partial unique index. Every Anthropic call (none yet in Slice 1, but the helper is wired) records `model`, `input_tokens`, `output_tokens` to `conversation_messages`. A `/api/settings/cost` endpoint sums current-month token spend and projects against $80 ceiling. C-5 enforcement is at the DB layer, not the UI.

### S1-T18 — End-to-end smoke test on production
- **Owner:** engineering-sre
- **Blocks:** Slice 1 acceptance gate
- **Depends on:** S1-T11, S1-T14, S1-T15, S1-T16
- **Hours:** 2–4h
- **Acceptance test:** Run the full Slice 1 happy path on production (`cowork.lotview.ai`): login → add project → daemon online → dispatch "list files" → see streamed output → task completes → refresh browser → state persists. Result documented in `/docs/evidence/slice-1-smoke.md` with timestamps and screenshots/log excerpts.

### S1-T19 — UU-3 verification: TTI ≤ 3s on production
- **Owner:** engineering-frontend-developer
- **Blocks:** none (informational)
- **Depends on:** S1-T11
- **Hours:** 1–2h
- **Acceptance test:** Chrome DevTools TTI measurement on first paint of `cowork.lotview.ai` recorded in `/docs/evidence/uu-3-tti.md`. Result either confirms NFR-1 or escalates with a profile attached.

### Slice 1 acceptance gate
- All 19 tasks green.
- C-4 evidence (real claude PID + stream) on file.
- C-2 evidence (daemon crash → no silent drop) on file.
- C-3 honored: no fabricated empty states.
- Smoke test from S1-T18 reproduces cleanly.
- COO writes "Slice 1 green — proof-of-architecture confirmed" before Slice 2 begins.

**Slice 1 total: 64–101 hours.**

---

## Slice 2 — Jarvis + CEO + agent chat (target: week 2)

Goal: per-project CEO chat works; Jarvis ambient chat works; agent definitions sync from daemon; morning briefing fires opus exactly once per session entry.

### S2-T1 — Agent definitions sync endpoint + daemon fs.watch
- **Owner:** engineering-backend-architect
- **Hours:** 4–6h
- **Acceptance test:** Daemon on startup POSTs every `*.md` from `~/.claude/agents/` to `/api/agents/sync`; HQ upserts by `content_hash`; editing a local file pushes an update within 30s; deleting a file marks the row `deleted_at`. UU-5 verified: actual file format documented in `/docs/evidence/uu-5-agent-format.md`.
- **Depends on:** S1-T16

### S2-T2 — Anthropic SDK relay: stream tokens to socket room
- **Owner:** engineering-backend-architect
- **Hours:** 5–7h
- **Acceptance test:** `chat.send` → server reconstructs history → calls `anthropic.messages.stream` → emits `message.token` chunks to project/global room → on complete, persists `conversation_messages` row with input/output tokens; transcript visible live in browser.
- **Depends on:** S1-T17, S2-T1

### S2-T3 — Per-project CEO chat UI
- **Owner:** engineering-frontend-developer
- **Hours:** 4–6h
- **Acceptance test:** Workstation page has a chat panel; sending a message streams CEO reply token-by-token; history persists across refresh; empty conversation shows empty state (no fabricated welcome from CEO — C-3 unless explicitly authored).
- **Depends on:** S2-T2

### S2-T4 — Jarvis global chat (FAB on mobile, sidebar on desktop)
- **Owner:** engineering-frontend-developer
- **Hours:** 4–6h
- **Acceptance test:** Jarvis input reachable from every view in one tap/click; replies stream within 3s; Jarvis cannot dispatch tasks autonomously — confirms target project first (FR-5.5).
- **Depends on:** S2-T2

### S2-T5 — Morning briefing trigger + opus-once-per-day enforcement
- **Owner:** engineering-backend-architect
- **Hours:** 4–6h
- **Acceptance test:** First session entry after ≥6h gap triggers an opus briefing; partial unique index prevents a second auto-trigger same calendar day; manual "Re-run" button bypasses the index; quiet-day briefing renders the literal "Quiet since yesterday — nothing to report" without fabricating activity.
- **Depends on:** S2-T2

### S2-T6 — Briefing UI: dismissible, persists dismissal for the day
- **Owner:** engineering-frontend-developer
- **Hours:** 2–3h
- **Acceptance test:** Briefing panel renders the streamed briefing; dismiss button sets `dismissed_at`; same-day re-entry does not re-prompt; "Re-run briefing" button is available.
- **Depends on:** S2-T5

### S2-T7 — Cost guard: model selection enforced, ambient Jarvis on sonnet
- **Owner:** engineering-backend-architect
- **Hours:** 2–3h
- **Acceptance test:** Config map `MODEL_BY_AGENT_TIER` is the only place model strings appear; integration test asserts Jarvis ambient queries use sonnet, briefings use opus, no path bypasses the map. C-5 architectural enforcement.
- **Depends on:** S2-T2

### Slice 2 acceptance gate
- All 7 tasks green.
- Briefing fires once per day with cost recorded.
- Jarvis cannot dispatch a task without confirmation.
- Agent sync handles add/edit/delete on real operator agent files.

**Slice 2 total: 25–37 hours.**

---

## Slice 3 — 2D office canvas + tab bar polish (target: week 2 / early week 3)

### S3-T1 — `OfficeFloor` component with positioned sprites
- **Owner:** engineering-frontend-developer
- **Hours:** 5–7h
- **Acceptance test:** Desktop dashboard renders one sprite per project at fixed positions; sprite has a CSS-keyframe breathing animation; data shape supports future PixiJS swap. Reflects UU-7 verdict from S0-T7.
- **Depends on:** S0-T7, S1-T8

### S3-T2 — Per-sprite status badges (color + shape + label, never color alone)
- **Owner:** engineering-frontend-developer
- **Hours:** 3–4h
- **Acceptance test:** Each sprite shows a badge that updates live via `project.updated` socket event; ADHD constraint enforced — color is never the sole status carrier (FR-1.5, NFR-4).
- **Depends on:** S3-T1

### S3-T3 — Bottom tab bar with horizontal scroll-snap, persistent Jarvis tab
- **Owner:** engineering-frontend-developer
- **Hours:** 3–4h
- **Acceptance test:** Tab bar shows one tab per project; at >7 projects, tabs scroll-snap horizontally (OQ-6); Jarvis anchors at left edge and does not scroll out; touch targets ≥44px.
- **Depends on:** S3-T1

### S3-T4 — Workstation detail four-panel layout
- **Owner:** engineering-frontend-developer
- **Hours:** 4–6h
- **Acceptance test:** Workstation page on 1440×900 viewport shows four panels without scrolling: task list, CEO chat, git activity, deploy status. Each panel has an empty state. Loads in ≤2s on desktop broadband (FR-3.1).
- **Depends on:** S2-T3, S3-T1

### S3-T5 — Empty-state pass: every status surface
- **Owner:** engineering-frontend-developer
- **Hours:** 2–3h
- **Acceptance test:** Reviewer checklist in `/docs/evidence/c-3-empty-states.md` confirms every panel (dashboard, workstation, activity, deploy, briefing) renders an explicit empty state and never fabricates data. C-3 audit pass.
- **Depends on:** S3-T4

### Slice 3 acceptance gate
- Operator can identify status of every project in ≤10s without reading more than a 1-word label (FR-1.5).
- All five panels enforce explicit empty states.

**Slice 3 total: 17–24 hours.**

---

## Slice 4 — Activity feeds: GitHub + Render (target: week 3)

### S4-T1 — GitHub polling worker (every 5 min per project)
- **Owner:** engineering-backend-architect
- **Hours:** 4–6h
- **Acceptance test:** Polling worker writes commits to `activity_feed_items` with idempotent upsert; rate limit handled gracefully (FR-10.E1); `last_github_sync_at` + `last_github_status` updated.
- **Depends on:** S1-T11

### S4-T2 — Render API polling worker (deploy status)
- **Owner:** engineering-backend-architect
- **Hours:** 3–5h
- **Acceptance test:** Polling worker writes deploy events; project without Render service ID is skipped silently (no fabricated "healthy" — C-3); auth failure surfaces inline.
- **Depends on:** S1-T11

### S4-T3 — Activity feed UI with source filter + stale badges
- **Owner:** engineering-frontend-developer
- **Hours:** 3–5h
- **Acceptance test:** Workstation activity panel renders real items only; stale data (>10 min) shows badge; failed sync shows "last sync N minutes ago — failed"; empty feed shows empty state.
- **Depends on:** S4-T1, S4-T2, S3-T4

### S4-T4 — Live broadcast of new activity items
- **Owner:** engineering-backend-architect
- **Hours:** 1–2h
- **Acceptance test:** New activity items emit `activity.new` to project room; UI prepends without refresh.
- **Depends on:** S4-T1, S4-T2

### Slice 4 acceptance gate
- All activity displayed is real, fetched, and timestamped. Zero fabrication.

**Slice 4 total: 11–18 hours.**

---

## Slice 5 — Check-in interview + checkpoint saves (target: week 3)

### S5-T1 — Check-in interview state machine
- **Owner:** engineering-backend-architect
- **Hours:** 4–6h
- **Acceptance test:** `interview_states` row created on first entry after 48h gap; each operator answer persists immediately; resume from last unanswered question works across device switch.
- **Depends on:** S2-T3

### S5-T2 — Check-in interview UI + 7-day dismissal cooldown
- **Owner:** engineering-frontend-developer
- **Hours:** 3–5h
- **Acceptance test:** Interview prompts on stale workstation entry; dismissal sets `interview_dismissed_at` and suppresses for 7 days (OQ-8); "Run check-in" button always available.
- **Depends on:** S5-T1

### S5-T3 — Checkpoint save endpoint + daemon SHA fetch
- **Owner:** engineering-backend-architect
- **Hours:** 3–4h
- **Acceptance test:** Checkpoint save requires daemon online (button disabled otherwise); daemon supplies HEAD SHA; row persists with label + SHA; no git tag written (FR-8.3).
- **Depends on:** S1-T16

### S5-T4 — Checkpoint list UI with GitHub commit-detail fetch (1h cache)
- **Owner:** engineering-frontend-developer
- **Hours:** 3–4h
- **Acceptance test:** Project checkpoint list renders SHA + label + date; tapping fetches commit message + file summary from GitHub with 1h cache; delete is hard-delete (low stakes).
- **Depends on:** S5-T3

### Slice 5 acceptance gate
- Interview survives device switch and dismissal cooldown.
- Checkpoint button correctly degrades when daemon offline.

**Slice 5 total: 13–19 hours.**

---

## Slice 6 — Mobile PWA (target: late week 3)

### S6-T1 — PWA manifest + service worker + install flow
- **Owner:** engineering-frontend-developer
- **Hours:** 3–5h
- **Acceptance test:** App is installable on iOS Safari and Android Chrome; manifest scope `/`; home-screen icon present.
- **Depends on:** S1-T18

### S6-T2 — Mobile reporting dashboard (no canvas, tab bar over grid)
- **Owner:** engineering-frontend-developer
- **Hours:** 4–6h
- **Acceptance test:** On mobile breakpoints (375–430px), canvas asset is **not requested** (network panel verifies); reporting grid shows per-project status; all touch targets ≥44px; body font ≥16px.
- **Depends on:** S6-T1, S3-T2

### S6-T3 — Mobile workstation: chat, task list, dispatch, check-in
- **Owner:** engineering-frontend-developer
- **Hours:** 4–6h
- **Acceptance test:** Operator can dispatch a task, see streamed output, take a check-in interview, and chat with the CEO entirely on mobile.
- **Depends on:** S6-T2

### S6-T4 — UU-6 verification: PWA + WebSocket + background/foreground
- **Owner:** engineering-sre
- **Hours:** 2–3h
- **Acceptance test:** Background the PWA on iOS 10 minutes, foreground → state resyncs within 2s via Socket.IO reconnect + REST refetch. Evidence in `/docs/evidence/uu-6-pwa-resync.md`.
- **Depends on:** S6-T3

### Slice 6 acceptance gate
- Operator self-test: dispatch one task from phone, end-to-end, including check-in.

**Slice 6 total: 13–20 hours.**

---

## Slice 7 — Polish, reliability hardening, evidence collection (target: week 4)

### S7-T1 — UU-1 verification: React 19 strict mode + Socket.IO singleton
- **Owner:** engineering-frontend-developer
- **Hours:** 1–2h
- **Acceptance test:** Verify only one socket per browser tab even under strict mode double-mount. Evidence in `/docs/evidence/uu-1-socket.md`.

### S7-T2 — UU-8 verification: streaming backpressure under slow client
- **Owner:** engineering-sre
- **Hours:** 2–3h
- **Acceptance test:** 10MB of `task.output` events to a deliberately slow client; server does not OOM; either backpressures or truncates that one client per fallback plan. Evidence in `/docs/evidence/uu-8-backpressure.md`.

### S7-T3 — UU-9 verification: Render Redis Starter connection cap under load
- **Owner:** engineering-devops-automator
- **Hours:** 1–2h
- **Acceptance test:** Under steady-state load (1 daemon + HQ web), monitor connection count vs Render Starter cap. Evidence in `/docs/evidence/uu-9-redis-cap.md`.

### S7-T4 — Operator daily-driver self-test for 3 consecutive workdays
- **Owner:** engineering-sre
- **Hours:** 4–6h (mostly observation)
- **Acceptance test:** Riley uses HQ as sole driver for 3 consecutive workdays. Zero terminal sessions outside the daemon. Logged in `/docs/evidence/day-10-criterion.md`. Day-10 success metric for the PRD.

### S7-T5 — Cost report: actual month-1 spend vs $80 ceiling
- **Owner:** engineering-backend-architect
- **Hours:** 1–2h
- **Acceptance test:** Settings page renders month-to-date Anthropic + Render spend; an alert fires if projected month-end exceeds $80. C-5 observability.

### S7-T6 — Bug burndown
- **Owner:** all engineering roles
- **Hours:** 8–16h (variable)
- **Acceptance test:** Issue tracker shows zero P1 or P2 bugs at slice end.

### S7-T7 — Documentation pass: install README, daemon troubleshooting, runbook
- **Owner:** engineering-devops-automator
- **Hours:** 3–5h
- **Acceptance test:** `/README.md` + `/docs/runbook.md` + `/docs/daemon-install.md` written. Someone other than the implementer can install the daemon following the doc.

### Slice 7 acceptance gate
- All 8 known unknowns from architecture §9 have written verdicts.
- Day-10 criterion satisfied.
- Cost ceiling holding under real usage.
- COO writes "Cowork HQ v1 — shipped" note.

**Slice 7 total: 20–36 hours.**

---

## Portfolio summary

| Slice | Hours (low) | Hours (high) | Calendar target |
| --- | --- | --- | --- |
| Slice 0 | 16 | 25 | Days 1–2 |
| Slice 1 | 64 | 101 | Days 3–9 |
| Slice 2 | 25 | 37 | Days 10–13 |
| Slice 3 | 17 | 24 | Days 14–16 |
| Slice 4 | 11 | 18 | Days 17–18 |
| Slice 5 | 13 | 19 | Days 19–20 |
| Slice 6 | 13 | 20 | Days 21–23 |
| Slice 7 | 20 | 36 | Days 24–28 |
| **Total** | **179** | **280** | **3.5–5.5 weeks of focused solo work** |

At 35 productive solo-operator hours per week: low-end 5 weeks, high-end 8 weeks. The architect's "3–4 weeks" estimate holds only if the operator hits the low-end on every slice. Realistic plan: 4–5 weeks for a working ship, with Slice 7 spilling into a maintenance period.

---

## Top risks (single line each)

1. **S1-T14 (daemon spawns real `claude` and streams stdout) is the single named risk for Slice 1.** It composes UU-2 (Windows execution mode), UU-4 (BullMQ stall on crash), C-4 (real binary requirement), and the full Redis pub/sub → Socket.IO relay. If any one fails, Slice 1 does not ship.
2. **Render Redis Starter connection cap (UU-9)** could force a $20/mo overage that breaks C-5 budget.
3. **TTI on Render Standard (UU-3)** may force either a Pro plan upgrade ($25 over budget) or aggressive SSR caching work not scoped here.

---

**End of tasks-v1.**
