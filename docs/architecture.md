# Claude Cowork HQ — Architecture v1

**Status:** Approved for build
**Date:** 2026-06-05
**Author:** Chief Architect
**Source documents:** `prd-v1.md`, `requirements-2026-06-05.md`, `discovery-2026-06-05.md`
**Hands to:** engineering-backend-architect, engineering-frontend-developer, engineering-devops-automator, engineering-database-optimizer

---

## 0. TL;DR

- **Stack:** Mirror Lotview verbatim. TypeScript + React 19 + Vite (frontend), Express + Node 20 (backend), Drizzle + Postgres 16, Tailwind + Radix, BullMQ + Redis, deployed on Render. Zero gratuitous deviation.
- **2D canvas:** Option C (pure CSS/HTML with positioned sprite divs). Avatar movement is v2-locked; nothing in v1 requires a game engine. Phaser/PixiJS deferred to v1.5 if visual richness becomes a real product gap.
- **Daemon:** Node.js 20, packaged with `pkg` or shipped as a self-contained binary, installed via PowerShell, supervised by NSSM. Same language as HQ so the operator never context-switches on tooling.
- **Real-time:** Socket.IO over the existing Express HTTP server (same pattern Lotview uses for live deal updates). Anthropic streaming responses relay token-by-token through the same socket.
- **Auth:** Single-password POST to `/api/auth/login` → HttpOnly secure session cookie (signed JWT, 30-day rolling expiry). Cookie auth on both REST and WebSocket handshake.
- **First shippable slice:** One project, one dispatched task, real `claude` child process running on the Windows daemon, stdout streamed to the browser. No canvas, no Jarvis, no PWA, no GitHub feed. This is the proof-of-architecture.
- **Build estimate:** 3–4 weeks of focused solo work. Not 2 days. Not 2 weeks.

---

## 1. Stack decision

### Recommendation

**Mirror Lotview's stack exactly. No deviation in v1.**

| Layer | Choice | Rationale |
| --- | --- | --- |
| Frontend framework | React 19 + Vite + TypeScript | Lotview convention; operator already knows the build/dev loop. |
| UI primitives | Tailwind + Radix | Lotview convention; accessibility primitives match NFR-4 ADHD targets. |
| Backend | Express + Node.js 20 LTS | Lotview convention; combined HTTP + WebSocket server. |
| ORM + DB | Drizzle + PostgreSQL 16 | Lotview convention; typed schema with cheap migrations. |
| Job queue | BullMQ + Redis | Lotview convention; gives us DLQ, retries, observability for free over raw Redis lists. |
| Anthropic | `@anthropic-ai/sdk` (latest) | Lotview convention; streaming response API is stable. |
| Hosting | Render (Standard web + Standard Postgres + Starter Redis) | Lotview convention; same render.yaml blueprint pattern. |

### Alternatives considered

- **Next.js instead of Vite + Express.** Rejected: introduces app router learning curve, complicates the Express + Socket.IO same-process pattern, and Lotview already proves Vite + Express works.
- **Fastify instead of Express.** Rejected: marginal perf gains do not justify diverging from Lotview's middleware ecosystem.
- **Prisma instead of Drizzle.** Rejected: same as above — Lotview convention, no business reason to switch.

### Deltas from Lotview

There are **no** technology deltas. The only architectural deltas are:

1. **Socket.IO usage is heavier** than Lotview (Lotview uses sockets for occasional updates; HQ uses them as the primary real-time spine for task streaming and cross-device sync).
2. **A second deployable unit exists** — the Windows daemon — which Lotview does not have.
3. **No multi-tenant scoping** — every query is operator-scoped by virtue of there being one operator (C-1).

### Confidence: 9/10

The one thing I would verify before committing: **Drizzle + Postgres `jsonb` migration ergonomics for the `interview_states.answers` column.** If the operator wants to evolve the answer shape, Drizzle migrations on jsonb fields are smooth but not zero-effort. Falls under "known known."

---

## 2. 2D canvas approach

### Recommendation

**Option C — pure CSS/HTML with positioned sprite divs and CSS keyframe ambient animation.**

### Rationale

The PRD's v2 lock on avatar movement (C-6) is the discriminating constraint. Without movement, the 2D office is a **static visual dashboard with 18 placed agent sprites and dynamic status badges** — not a game world. Phaser and PixiJS exist to solve problems we do not have in v1:

- No real-time sprite movement
- No tile collision
- No camera pan/zoom
- No game loop driving per-frame state
- No physics

What we do have:

- 18 sprite tiles to render in fixed positions
- Per-sprite status badges that update via WebSocket
- Idle bob/breathing animation (a CSS keyframe of 2-3 frames is sufficient)
- Optional horizontal scroll if the office gets wider than viewport

CSS-positioned divs with `background-image: url(...)` and `steps()`-based keyframe animation handle this completely. No game engine. No 1MB bundle. No React integration friction.

### Alternatives considered

**Option A — Phaser 3.** Rejected for v1.
- ~1MB bundle even after lazy-load is a real cost on first paint and hurts NFR-1 (TTI ≤ 3s).
- React 19 + Vite + Phaser integration friction is **unverified by me**. There are known patterns (mount Phaser into a ref'd div outside React's reconciler), but the "clean stream" path is not guaranteed and would need a spike.
- Buys nothing we need in v1.

**Option B — PixiJS + @pixi/react.** Rejected for v1, but **this is the v1.5 upgrade path** if the office needs to feel more alive.
- Lighter than Phaser (~500KB), focused on rendering.
- `@pixi/react`'s React 19 compatibility is also **unverified by me** — could be partial. Would need a spike.
- Worth picking up when avatar movement comes off the v2 lock.

### Confidence: 8/10

The 2/10 of doubt: I am projecting that 18 statically positioned sprites with CSS keyframes will feel "alive enough" to satisfy the Sims-like ambient feel. If after the v1 ship the operator reports it feels dead, the upgrade to PixiJS is a contained refactor (replace one component, not the whole frontend).

**Verification before committing:** Build a quick 1-hour visual spike with 4 sprites positioned absolutely in a `.office-floor` div, each with a `steps(2, end)` infinite breathing animation. If the feel is acceptable, ship it. If it feels static and dead, escalate to PixiJS spike.

**Fallback:** If CSS proves insufficient, swap the `OfficeFloor` React component for a PixiJS-backed component without changing any other code. The data shape (agent positions, statuses) does not change.

---

## 3. Postgres schema (DDL)

Full v1 DDL. Drizzle migration files derived from this.

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE project_status      AS ENUM ('active', 'paused', 'archived');
CREATE TYPE task_status         AS ENUM ('queued', 'in_progress', 'completed', 'cancelled', 'failed');
CREATE TYPE message_role        AS ENUM ('user', 'agent', 'system');
CREATE TYPE message_scope       AS ENUM ('project', 'global');
CREATE TYPE activity_source     AS ENUM ('github', 'render');
CREATE TYPE fetch_status        AS ENUM ('success', 'stale', 'failed', 'rate_limited');
CREATE TYPE agent_tier          AS ENUM ('jarvis', 'ceo', 'director');

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  local_path            TEXT NOT NULL,                  -- daemon-host working directory
  repo_url              TEXT,                            -- nullable; degrades gracefully
  github_owner          TEXT,                            -- parsed from repo_url for API calls
  github_repo           TEXT,
  render_service_id     TEXT,
  status                project_status NOT NULL DEFAULT 'active',
  websearch_enabled     BOOLEAN NOT NULL DEFAULT TRUE,  -- OQ-7 per-project override
  github_reachable      BOOLEAN NOT NULL DEFAULT TRUE,
  last_github_sync_at   TIMESTAMPTZ,
  last_github_status    fetch_status,
  last_render_sync_at   TIMESTAMPTZ,
  last_render_status    fetch_status,
  last_active_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checkin_at       TIMESTAMPTZ,
  interview_dismissed_at TIMESTAMPTZ,                    -- OQ-8 7-day cooldown anchor
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ                       -- 30-day soft-delete (FR-7.6)
);

CREATE INDEX idx_projects_status_active ON projects (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_last_active ON projects (last_active_at DESC) WHERE deleted_at IS NULL;

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title                 TEXT NOT NULL,
  prompt                TEXT NOT NULL,                   -- the full operator prompt sent to claude
  status                task_status NOT NULL DEFAULT 'queued',
  daemon_session_id     TEXT,                            -- UUID tag the daemon emits per child process
  exit_code             INTEGER,
  error_message         TEXT,
  output_summary        TEXT,                            -- short summary for list view
  transcript            TEXT,                            -- full stdout+stderr (truncated at 10MB per FR-4 edge case)
  truncated             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ
);

CREATE INDEX idx_tasks_project_status ON tasks (project_id, status);
CREATE INDEX idx_tasks_project_created ON tasks (project_id, created_at DESC);
CREATE INDEX idx_tasks_active ON tasks (status) WHERE status IN ('queued', 'in_progress');

-- ============================================================
-- CONVERSATION_MESSAGES
-- ============================================================
CREATE TABLE conversation_messages (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope                 message_scope NOT NULL,         -- 'project' or 'global' (Jarvis)
  project_id            UUID REFERENCES projects(id) ON DELETE RESTRICT,  -- nullable for global
  agent_id              TEXT NOT NULL,                   -- references agent_definitions.name
  role                  message_role NOT NULL,
  content               TEXT NOT NULL,
  task_id               UUID REFERENCES tasks(id) ON DELETE SET NULL,
  -- model + token accounting for cost monitoring (NFR-6)
  model                 TEXT,                            -- e.g. 'claude-opus-4-7' or 'claude-sonnet-4-6'
  input_tokens          INTEGER,
  output_tokens         INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT msg_scope_matches_project CHECK (
    (scope = 'global' AND project_id IS NULL) OR
    (scope = 'project' AND project_id IS NOT NULL)
  )
);

CREATE INDEX idx_msgs_project_created ON conversation_messages (project_id, created_at) WHERE scope = 'project';
CREATE INDEX idx_msgs_global_created  ON conversation_messages (created_at) WHERE scope = 'global';
CREATE INDEX idx_msgs_task            ON conversation_messages (task_id) WHERE task_id IS NOT NULL;

-- ============================================================
-- CHECKPOINT_SAVES (FR-8 — DB-only, no git tag in v1, OQ-1 resolved)
-- ============================================================
CREATE TABLE checkpoint_saves (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label                 TEXT NOT NULL,
  git_sha               TEXT NOT NULL,                   -- HEAD SHA reported by daemon
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkpoints_project_created ON checkpoint_saves (project_id, created_at DESC);

-- ============================================================
-- ACTIVITY_FEED_ITEMS (FR-10)
-- ============================================================
CREATE TABLE activity_feed_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source                activity_source NOT NULL,
  event_type            TEXT NOT NULL,                   -- 'commit', 'deploy_success', 'deploy_failed', etc.
  external_id           TEXT NOT NULL,                   -- GitHub SHA or Render deploy ID
  summary               TEXT NOT NULL,
  url                   TEXT,                            -- deep link back to source
  metadata              JSONB,                           -- author, branch, status_detail, etc.
  occurred_at           TIMESTAMPTZ NOT NULL,
  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, source, external_id)              -- idempotent inserts on poll
);

CREATE INDEX idx_activity_project_occurred ON activity_feed_items (project_id, occurred_at DESC);
CREATE INDEX idx_activity_source           ON activity_feed_items (project_id, source, occurred_at DESC);

-- ============================================================
-- INTERVIEW_STATES (FR-6, OQ-8)
-- ============================================================
CREATE TABLE interview_states (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  current_question_index INTEGER NOT NULL DEFAULT 0,
  answers               JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

-- ============================================================
-- AGENT_DEFINITIONS (FR-12)
-- ============================================================
CREATE TABLE agent_definitions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename              TEXT NOT NULL UNIQUE,            -- e.g. 'engineering-backend-architect.md'
  name                  TEXT NOT NULL,                   -- agent's declared name
  tier                  agent_tier NOT NULL DEFAULT 'director',
  model_override        TEXT,                            -- optional per-agent model
  persona               TEXT NOT NULL,                   -- raw markdown body
  raw_content           TEXT NOT NULL,                   -- complete file content for audit
  source_path           TEXT NOT NULL,                   -- absolute path on daemon host
  content_hash          TEXT NOT NULL,                   -- SHA-256 of raw_content for change detection
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ                       -- FR-12 edge case: file removed locally
);

CREATE INDEX idx_agent_defs_tier ON agent_definitions (tier) WHERE deleted_at IS NULL;

-- ============================================================
-- SESSIONS (auth — single operator, but multiple devices)
-- ============================================================
CREATE TABLE sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash            TEXT NOT NULL UNIQUE,            -- SHA-256 of the JWT signature for revocation
  device_label          TEXT,                            -- 'Desktop Chrome', 'iPhone PWA' — heuristic
  user_agent            TEXT,
  ip_address            INET,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL,
  revoked_at            TIMESTAMPTZ
);

CREATE INDEX idx_sessions_active ON sessions (expires_at) WHERE revoked_at IS NULL;

-- ============================================================
-- BRIEFING_GENERATIONS (cost ceiling enforcement — FR-2.6, NFR-6)
-- ============================================================
CREATE TABLE briefing_generations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  briefing_date         DATE NOT NULL,                   -- calendar day in operator's timezone
  triggered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_reason        TEXT NOT NULL,                   -- 'session_entry_gap', 'manual_rerun'
  content               TEXT NOT NULL,
  model                 TEXT NOT NULL,
  input_tokens          INTEGER NOT NULL,
  output_tokens         INTEGER NOT NULL,
  dismissed_at          TIMESTAMPTZ
);

-- Calendar-day uniqueness: at most one opus briefing per day unless manual rerun
CREATE UNIQUE INDEX idx_briefings_one_per_day
  ON briefing_generations (briefing_date)
  WHERE trigger_reason = 'session_entry_gap';

-- ============================================================
-- DAEMON_HEARTBEATS (FR-4.6, daemon health observability)
-- ============================================================
CREATE TABLE daemon_heartbeats (
  id                    BIGSERIAL PRIMARY KEY,
  daemon_id             TEXT NOT NULL,                   -- stable installer-generated ID
  host_name             TEXT,
  daemon_version        TEXT,
  active_task_id        UUID REFERENCES tasks(id) ON DELETE SET NULL,
  reported_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_heartbeats_recent ON daemon_heartbeats (daemon_id, reported_at DESC);
-- Note: heartbeats are also written to Redis with TTL=60s for fast "online" checks.
-- DB rows are retained for daemon uptime calc (success criterion: 99% over rolling 30 days).
```

### Non-obvious design notes

- **`projects.local_path` is immutable after creation** at the application layer (FR-7.4). Not enforced by DDL — enforced in the API handler.
- **`conversation_messages.scope`** discriminator + check constraint cleanly separates Jarvis (global) from per-project CEO/director messages without two tables.
- **`activity_feed_items` UNIQUE (project_id, source, external_id)** makes the 5-minute poll idempotent — upsert on conflict, no duplicate commits when GitHub returns overlapping pages.
- **`briefing_generations` partial unique index** enforces "at most one auto-triggered opus briefing per calendar day" at the DB level — not in UI code. This is C-5 enforcement. Manual reruns are explicitly excluded from the unique constraint so the operator can force one.
- **`agent_definitions.content_hash`** lets the daemon's filesystem watcher skip POSTs when a file's mtime changed but contents didn't.
- **`sessions.token_hash`** stores the SHA-256 of the JWT signature — lets us revoke individual devices without rotating the signing secret.
- **No `users` table.** C-1 forbids it. The auth secret is a single bcrypt hash in env var; sessions exist only to allow per-device revocation and visibility into "what devices are logged in."

---

## 4. Real-time strategy

### Recommendation

**Socket.IO 4.x mounted on the same Express HTTP server.** REST for CRUD, Socket.IO for streams and broadcasts.

### Why Socket.IO over raw `ws` or SSE

| Need | Socket.IO | Raw ws | SSE |
| --- | --- | --- | --- |
| Bidirectional (task cancel, chat send) | Yes | Yes | One-way only |
| Rooms (per-project broadcast) | Built-in | Hand-rolled | N/A |
| Automatic reconnect + backoff | Built-in | Hand-rolled | Built-in but limited |
| Mobile background/foreground resync | Handled cleanly | Edge cases | SSE drops on bg |
| Cookie auth on handshake | First-class | Manual | Native |
| Lotview parity | Already in use | — | — |

The PRD requires <2s cross-device sync, streaming task output, and reconnection-with-delta-replay. SSE is one-way (rules out task cancel over the same channel). Raw `ws` works but we'd reimplement rooms and reconnect — that's reinventing Socket.IO badly.

### Channel design

```
Socket.IO Rooms
├── room: "global"                          → Jarvis updates, daemon online/offline, project list changes
├── room: "project:{project_id}"            → that project's task list, chat, checkpoints, activity feed
├── room: "task:{task_id}"                  → stdout/stderr stream for an in-progress task
└── room: "briefing:{date}"                 → live token stream of Jarvis briefing as it's authored
```

Every connected browser auto-joins `global`. When the operator opens a workstation, the client joins `project:{id}`. When a task starts streaming, the client joins `task:{id}`. Server-side leaves are automatic on disconnect.

### Event names (canonical)

```
// server → client
task.queued        { task }
task.started       { task_id, started_at }
task.output        { task_id, stream, chunk }    // stream='stdout'|'stderr'
task.completed     { task_id, exit_code, summary }
task.failed        { task_id, error_message }
task.cancelled     { task_id }
message.appended   { message }
project.updated    { project }
checkpoint.created { checkpoint }
activity.new       { feed_item }
daemon.status      { online: bool, last_seen_at, daemon_id }
briefing.token     { briefing_id, chunk }
briefing.complete  { briefing_id }

// client → server
chat.send            { project_id|null, content }     // null project_id => Jarvis
task.dispatch        { project_id, prompt, title }
task.cancel          { task_id }
checkpoint.create    { project_id, label, notes }
project.open         { project_id }                   // joins project room
project.close        { project_id }                   // leaves project room
```

### Reconnection + delta replay

Every server event carries a monotonic `event_id` (BIGSERIAL from a `socket_events` table OR Redis stream offset — choose Redis stream for hot path). On reconnect, client sends last-seen `event_id`; server replays from the Redis stream.

For v1 simplicity we will **not** persist a full event log — instead, on reconnect the client refetches REST state for any room it was in. Lossless replay is upgraded to a full event log in v1.5 if the operator hits visible gaps.

### Anthropic streaming relay

```
Anthropic SDK (stream=true) → server-side async iterator → 
  socket.to(room).emit('task.output' | 'briefing.token', { chunk })
```

No buffering on the server beyond what the SDK already buffers per-chunk. Backpressure handled by Socket.IO's per-socket send buffer.

---

## 5. Daemon architecture

### Language: Node.js 20 LTS

**Picked.** Same runtime as HQ. Claude Code CLI is itself a Node tool — co-located runtime avoids version-skew bugs. Operator already has Node toolchain familiarity.

Alternatives considered:
- **Python.** Rejected: introduces a second toolchain the solo operator must maintain.
- **Go.** Rejected: better static binaries but the rest of the codebase is TS — splitting languages is a tax we don't need.

### Distribution

- Bundled via `pkg` or `node --experimental-sea-config` into a single Windows `.exe`.
- Installed via PowerShell installer (`install.ps1`) that:
  1. Downloads the latest `cowork-daemon.exe` from a Render-hosted releases URL
  2. Writes config to `%APPDATA%\ClaudeCowork\daemon.toml`
  3. Installs and starts the NSSM service `ClaudeCoworkDaemon`
  4. Verifies first heartbeat reaches HQ before declaring success

### Supervision

- **NSSM (Non-Sucking Service Manager).** Restart-on-crash with exponential backoff capped at 60s. NSSM logs go to `%PROGRAMDATA%\ClaudeCowork\daemon.log` (rotated daily, 7 days retained).
- NSSM startup type: Automatic (Delayed Start) — gives Windows networking time to come up before the daemon starts polling Redis.

### Configuration

The installer writes `daemon.toml`:

```toml
hq_url      = "https://cowork.lotview.ai"
hq_api_key  = "..."                       # daemon-only token, separate from operator login
redis_url   = "rediss://..."              # TLS Redis URL provided at install time
daemon_id   = "01H7..."                   # UUID generated at install time
agents_dir  = "C:\\Users\\Riley\\.claude\\agents"
log_level   = "info"
```

The installer collects `hq_url`, `hq_api_key`, and `redis_url` interactively (or via flags). The `daemon_id` is generated locally and registered with HQ on first heartbeat.

### Core loop

```
on startup:
  1. parse daemon.toml
  2. open Redis connection (TLS)
  3. scan agents_dir → POST every *.md to /api/agents/sync (idempotent on content_hash)
  4. start fs.watch on agents_dir → on change, re-POST
  5. start heartbeat interval (every 30s):
       a. SETEX redis "daemon:heartbeat:{daemon_id}" 60 {json status}
       b. POST /api/daemon/heartbeat { active_task_id }
  6. start task-pop loop:
       loop:
         job = await bull_queue.getNextJob({ block: true, timeout: 30s })
         if job:
           handle(job)
```

### Task handling

```
handle(job):
  task_id = job.data.task_id
  project = await fetch /api/projects/{job.data.project_id}
  
  PATCH /api/tasks/{task_id} { status: 'in_progress', daemon_session_id, started_at }
  publish 'task.started' on Redis pub/sub channel tasks:{task_id}
  
  child = spawn('claude', [...args], { 
    cwd: project.local_path,
    env: { ...env, ANTHROPIC_API_KEY: ... },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  
  child.stdout.on('data', chunk => 
    redis.publish(`tasks:${task_id}:stream`, JSON.stringify({stream:'stdout', chunk})))
  child.stderr.on('data', chunk => same)
  
  child.on('exit', (code, signal) => {
    PATCH /api/tasks/{task_id} { 
      status: code === 0 ? 'completed' : signal === 'SIGTERM' ? 'cancelled' : 'failed',
      exit_code, completed_at, transcript: accumulated_output (truncated at 10MB)
    }
    job.moveToCompleted()  // BullMQ ACK
  })
  
  listen for redis pub on tasks:{task_id}:cancel → child.kill('SIGTERM')
```

### Reliability mechanisms (C-2)

| Failure mode | Mechanism |
| --- | --- |
| Daemon process crash mid-task | NSSM restart in <10s. BullMQ job remains "active" with TTL. On restart, daemon's recovery routine inspects active jobs owned by this `daemon_id`, marks them `failed` with `reason='daemon_restart'`, and ACKs them. The PRD says no silent drops; the operator sees `failed` not "queued forever." |
| Redis disconnect | ioredis auto-reconnect with exponential backoff. Heartbeat resumes on reconnect. Currently-running child processes continue; their output is buffered in-memory (capped at 10MB per task) and replayed to Redis on reconnect. |
| HQ web service down | Daemon continues popping and executing tasks (Redis is independent of HQ). Status PATCHes are retried with backoff. Operator sees no immediate disruption beyond UI being offline. |
| `claude` child process hangs | Configurable timeout per task (default 30 min). On timeout, daemon sends SIGTERM, then SIGKILL after 10s. Task marked `failed` with `reason='timeout'`. |
| Agent definition file deleted | Daemon POSTs DELETE to `/api/agents/{filename}` which sets `deleted_at`. CEOs referencing it surface "definition removed" rather than silently using a stale copy (FR-12 edge case). |
| Operator's project path missing | Daemon validates `project.local_path` before spawn. If missing, marks task `failed` with `reason='project_path_missing'` (FR-4 edge case). |
| Task error / unrecoverable | Per FR-4.4: before marking failed, daemon invokes a WebSearch tool (via Anthropic's web search tool in the spawned `claude` session itself — no separate API needed). The search becomes part of the task transcript. |

### Single-machine pinning (CT-2 / OQ-2 resolved)

V1 is **single-daemon, single-designated-host**. The daemon table tracks a single `daemon_id`. If two daemons register, the second one logs a warning and exits — we explicitly do not support multi-daemon in v1.

The PRD allows the operator to dispatch from any device (laptop, phone); tasks queue in Redis and execute on whichever machine runs the daemon (the designated desktop). If that machine is off, tasks stay `queued` until it powers on. The UI shows "daemon offline" so the operator knows.

---

## 6. Anthropic SDK integration shape

### Conversation thread model: **stateless reconstruction from DB**

The Anthropic Messages API is stateless. There is no "thread" object on Anthropic's side — every call sends the full `messages: [...]` array.

For each invocation:

```
const history = await db.query.conversationMessages.findMany({
  where: scope === 'project' 
    ? eq(messages.project_id, project_id)
    : eq(messages.scope, 'global'),
  orderBy: messages.created_at,
  limit: 200   // context-window-aware truncation
})

const response = await anthropic.messages.stream({
  model: modelFor(agent_tier),
  system: agent.persona,
  messages: history.map(toAnthropicMessage),
  max_tokens: 4096,
})
```

Truncation policy (v1): keep the **most recent 200 messages or 100K tokens, whichever comes first**. If the context window is approaching limits, summarize the oldest 50 messages into a single "system summary" message and persist that to a `conversation_summaries` table (deferred to v1.1 unless context bloat shows up sooner).

### Model selection (FR-2.2, NFR-6)

Config map in `src/config/models.ts`:

```typescript
export const MODEL_BY_AGENT_TIER = {
  jarvis_briefing:   'claude-opus-4-7',       // FR-2.2: opus only for briefings
  jarvis_ambient:    'claude-sonnet-4-6',     // ambient queries are sonnet (cost ceiling)
  project_ceo:       'claude-sonnet-4-6',     // FR-2.2 default for non-briefing
  director:          'claude-sonnet-4-6',
} as const
```

**Important — cost guard:** Jarvis ambient queries (FR-5) explicitly use **sonnet, not opus**. Opus is reserved for the once-per-day briefing. This is the architectural enforcement of NFR-6 / C-5.

### Streaming flow

```
Browser ──ws─→ HQ /chat.send
                  │
                  ├── persist user message to DB
                  ├── reconstruct history
                  └── anthropic.messages.stream(...)
                        │
                        for await (chunk of stream):
                          socket.to(room).emit('message.token', { id, delta })
                          accumulate
                        on complete:
                          persist agent message (with input/output tokens)
                          socket.to(room).emit('message.complete', { message })
```

No HQ-side buffering beyond the Anthropic SDK's per-event boundary. Token-level latency from Anthropic to browser is sub-200ms on broadband.

### Briefing cost enforcement (FR-2.6, NFR-6, C-5)

Before invoking opus for a briefing, the server attempts an INSERT into `briefing_generations` with `trigger_reason='session_entry_gap'`. The partial unique index makes it fail on the second attempt of the same day. If insert fails → return the existing briefing row. **The cost ceiling is enforced in the database, not the UI.**

Manual reruns bypass the unique index but require the operator to explicitly tap "Re-run briefing" — there is no automatic re-trigger.

### Token + cost observability

Every `conversation_messages` row records `model`, `input_tokens`, `output_tokens`. A nightly cron sums these by day and surfaces a "cost so far this month" widget in the operator's settings — gives early warning before the $80 ceiling is hit.

---

## 7. Auth mechanism

### Recommendation

**Single-password POST → HttpOnly secure JWT session cookie. Cookie auth on both REST and WebSocket handshake.**

### Why not HTTP Basic Auth

- PWA mobile UX: Basic Auth prompts on every cold start, breaks PWA install flow
- iOS Safari occasionally drops Basic Auth credentials when an app is backgrounded for >24h
- No clean way to log out from one device but not another

### Flow

1. Operator hits any route → server checks `cowork_session` cookie
2. If missing/invalid → redirect to `/login`
3. `/login` shows a single password field
4. POST `/api/auth/login` { password }
   - server: `bcrypt.compare(password, env.COWORK_PASSWORD_HASH)`
   - on success: sign JWT (HS256, secret in env), insert `sessions` row with `token_hash = sha256(jwt_signature)`, set cookie
   - cookie: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` (30 days, rolling)
5. Every subsequent request: middleware verifies JWT signature + checks `sessions.revoked_at IS NULL`
6. WebSocket handshake: Socket.IO `cookie` extraData reads the same cookie; same middleware
7. Logout: `DELETE /api/auth/session/{id}` sets `revoked_at`; the cookie is cleared

### Secrets

- `COWORK_PASSWORD_HASH` — bcrypt hash of the operator's password, env var on Render
- `COWORK_JWT_SECRET` — 64-byte random hex, env var on Render
- `COWORK_DAEMON_TOKEN` — separate token for daemon → HQ POSTs (heartbeat, agent sync, task status); env var on Render and in `daemon.toml`

No secret in any DB row in plaintext.

### Mobile PWA behavior

- Cookie persists in the PWA's WebView cookie jar; 30-day rolling expiry refreshed on each authenticated request
- On expiry → redirect to login (rare; only after 30 days idle)
- Add-to-Home-Screen install: PWA manifest's `scope: '/'` ensures cookies survive between cold launches

### Rate limiting

Login endpoint: 5 attempts per 15 minutes per IP (express-rate-limit + Redis store). Brute force is the only realistic threat against a single-password endpoint exposed to the public internet.

---

## 8. render.yaml

```yaml
# Claude Cowork HQ — Render blueprint
# Pattern follows Lotview convention: single combined web service (HTTP + Socket.IO + scheduler in-process),
# split to a worker service only when scale demands it.

services:
  - type: web
    name: claude-cowork
    runtime: node
    plan: standard
    region: oregon
    branch: main
    healthCheckPath: /api/health
    buildCommand: npm ci --ignore-scripts && npm run build
    startCommand: node dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: claude-cowork-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: claude-cowork-redis
          property: connectionString
      - key: ANTHROPIC_API_KEY
        sync: false                # set in Render dashboard
      - key: GITHUB_TOKEN
        sync: false
      - key: RENDER_API_KEY
        sync: false
      - key: COWORK_PASSWORD_HASH
        sync: false
      - key: COWORK_JWT_SECRET
        sync: false
      - key: COWORK_DAEMON_TOKEN
        sync: false
      - key: HQ_PUBLIC_URL
        value: https://cowork.lotview.ai
      - key: LOG_LEVEL
        value: info

databases:
  - name: claude-cowork-db
    plan: standard
    databaseName: cowork
    user: cowork
    region: oregon
    postgresMajorVersion: 16
    ipAllowList: []                # private network only

  - name: claude-cowork-redis
    plan: starter
    region: oregon
    ipAllowList: []
    maxmemoryPolicy: noeviction    # task queue must never lose jobs
```

### Subdomain

**Proposed: `cowork.lotview.ai`** — keeps it in the operator's existing brand domain, no new DNS provider, TLS via Render's automatic certs.

Fallback: the default `claude-cowork.onrender.com` works fine if DNS setup is deferred.

### Estimated monthly cost

| Item | Cost |
| --- | --- |
| Render Standard web service | $25 |
| Render Standard Postgres | $20 |
| Render Starter Redis | $10 |
| Anthropic API (1 opus briefing/day @ ~$0.20 + ~50 sonnet sessions/day @ ~$0.02) | $15–25 |
| **Total** | **~$70–80** |

This is **tight against C-5's $80 ceiling.** The token observability layer in §6 is the early warning system. If we trend over, the first lever is briefing frequency (e.g., every other day instead of daily) and the second is sonnet caching.

---

## 9. Unknown unknowns

Listed honestly. Each has a verification step and a fallback.

### UU-1: React 19 + Vite + Socket.IO client compatibility

- **What is uncertain:** Socket.IO 4.x client has historically had subtle issues with React's strict mode double-mounting (creates two sockets). React 19 has new behavior here.
- **Verification:** 30-line spike — `<App><SocketProvider>` rendering a counter that increments on server emits. Confirm one socket, not two.
- **Fallback:** Wrap socket creation in a useRef + module-level singleton; this pattern is documented and stable.

### UU-2: Claude Code CLI on Windows — native vs. WSL

- **What is uncertain:** I have not personally verified that `claude` ships as a native Windows binary vs. requiring WSL2. If WSL, daemon's `child_process.spawn('claude', ...)` becomes `spawn('wsl', ['claude', ...])` and `cwd` must be translated to a `/mnt/c/...` path.
- **Verification:** On the operator's Windows machine, run `where claude` and `claude --version` in plain PowerShell (not WSL). If both work, native. If not, daemon spawns through WSL.
- **Fallback:** Daemon ships with a config option `executor: "native" | "wsl"`. Installer detects and sets it. The path translation is 4 lines of code.

### UU-3: Render Standard plan actually hits NFR-1 (TTI ≤ 3s)

- **What is uncertain:** Render Standard web service is 0.5 CPU / 512MB. Initial server-side render + DB queries + WebSocket upgrade might breach 3s on first paint.
- **Verification:** After first shippable slice, measure TTI on the deployed URL with Chrome DevTools. If >3s, profile.
- **Fallback:** Render Pro plan ($85/mo) is one click away but blows the budget. Cheaper fix: aggressive SSR caching of the dashboard JSON for 5s, plus making the dashboard client-render-only with a skeleton.

### UU-4: BullMQ ACK semantics under daemon crash

- **What is uncertain:** When the daemon crashes mid-job, BullMQ marks the job as "stalled" after `lockDuration` expires (default 30s). Whether the in-flight transcript is preserved depends on whether the daemon flushed to DB before crash.
- **Verification:** Test: kill -9 daemon mid-task, verify task ends in `failed` (not stuck `in_progress`) within 60s.
- **Fallback:** Add a server-side reaper cron (every 60s) that finds `tasks.status='in_progress'` with no recent heartbeat and forces them to `failed`.

### UU-5: `~/.claude/agents/*.md` file format

- **What is uncertain:** The PRD doesn't specify the agent definition file format (frontmatter? plain markdown? naming convention for tier?). Daemon's parser must handle the operator's actual files.
- **Verification:** Read the operator's `~/.claude/agents/*.md` files before writing the parser. Don't assume.
- **Fallback:** Treat the whole file as `raw_content` + `persona`; only parse frontmatter if present. Tier defaults to `'director'` if not declared.

### UU-6: PWA on iOS — service worker + WebSocket interaction

- **What is uncertain:** iOS PWAs have historical bugs with WebSocket lifecycle when the app backgrounds. Resync on foreground may need explicit handling.
- **Verification:** After mobile slice ships, background the PWA for 10 minutes, foreground, verify state syncs within 2s.
- **Fallback:** On `visibilitychange → visible`, force a Socket.IO disconnect+reconnect + REST refetch of currently-open project state.

### UU-7: 2D office "feels alive enough" with CSS-only animation

- **What is uncertain:** Whether 18 CSS-animated sprites feel like a "Sims-like office" or feel like a static screenshot.
- **Verification:** Visual spike at week 1; show operator before committing to v1 polish.
- **Fallback:** Upgrade path to PixiJS is contained — one component swap.

### UU-8: Anthropic streaming + Socket.IO backpressure

- **What is uncertain:** If the operator opens a slow tab while a task is streaming 10MB of output, does Socket.IO buffer and OOM the server, or drop messages?
- **Verification:** Load test — 10MB of `task.output` events to a deliberately slow client.
- **Fallback:** Set `socket.conn.maxPayload` and switch to "drop chunks + show truncated" for that one socket while others continue.

### UU-9: Render Redis Starter plan — TLS from Windows daemon

- **What is uncertain:** Render's Starter Redis offers a `rediss://` TLS URL but the Starter plan has a connection cap; the daemon adds 1 connection + heartbeat traffic.
- **Verification:** Check current Render Redis Starter connection limit against expected load (HQ web + 1 daemon = 2 long-lived + transient).
- **Fallback:** Bump to Standard Redis ($30/mo) if connection cap is breached. Blows budget by $20; would need to drop briefing to every-other-day.

### UU-10: Single-password auth is enough deterrent

- **What is uncertain:** Whether a single shared password (no rate-limited 2FA, no IP allowlist) is enough to deter the actual threat model — opportunistic credential stuffing against a public URL.
- **Verification:** Surface this risk to CEO. C-1 (operator-only) doesn't preclude adding 2FA, but PRD says minimum-viable auth.
- **Fallback:** Add TOTP via `otplib` as a checkbox in v1.1 — schema already supports it (add a `totp_secret` env var). Hard cost: ~2 hours.

---

## 10. First shippable slice

### The thinnest end-to-end that proves the architecture works

**Definition of done for the proof-of-architecture slice:**

1. Operator visits `cowork.lotview.ai`, sees a login form
2. Logs in with single password → session cookie set
3. Sees an empty project list with "Add project" CTA
4. Adds one project: name + local Windows path (e.g., `C:\Users\Riley\projects\lotview`)
5. Project appears as a single card (no canvas, no tab bar polish)
6. Daemon is installed on the operator's Windows machine via PowerShell installer
7. Daemon connects to Redis, posts first heartbeat, HQ shows "daemon online"
8. Operator types a task: "list files in this directory"
9. Task appears as `queued`, then `in_progress` within 5s
10. Real `claude` child process runs in the project directory
11. stdout streams chunk-by-chunk into the browser via Socket.IO
12. Task completes; final status `completed`; transcript persists in DB
13. Operator refreshes browser; full state reloads from DB

**What this slice intentionally does NOT include:**

- 2D office canvas
- Jarvis (no global agent)
- Per-project CEO chat (just task dispatch)
- Morning briefing
- Check-in interview
- GitHub activity feed
- Render deploy status
- Checkpoint saves
- Mobile PWA polish
- Cross-device sync beyond basic Socket.IO broadcast

**Why this slice:**

It exercises every load-bearing piece of the architecture:

- Auth flow + session cookie + Socket.IO handshake
- Postgres write path
- Redis queue + BullMQ
- Daemon install + NSSM supervision + heartbeat
- Daemon → `claude` child process in correct CWD (C-4 satisfied)
- Socket.IO streaming relay
- DB persistence + reload-from-DB

If this slice ships and works reliably for 48 hours, the remaining 13 FRs are execution. If it doesn't, we've found the real risk early — not after building UI polish on a broken foundation.

**Target: end of week 1 of build.**

---

## 11. Delegation map

| Component | Owner subagent |
| --- | --- |
| HQ Express + Socket.IO server, REST endpoints, Anthropic relay | `engineering-backend-architect` |
| HQ React frontend, Tailwind/Radix layout, PWA shell | `engineering-frontend-developer` |
| Drizzle schema, migrations, query optimization | `engineering-database-optimizer` |
| Windows daemon implementation | `engineering-backend-architect` (daemon is Node, same competence) |
| PowerShell installer, NSSM config, daemon packaging | `engineering-devops-automator` |
| render.yaml, deploy pipeline, env var management | `engineering-devops-automator` |
| Production reliability (BullMQ stall recovery, heartbeat reaper) | `engineering-sre` |
| Auth flow + session security review | `security-architect` |
| Task dispatch automation patterns | `automation-governance-architect` |

---

## 12. Architectural constitution clauses introduced

Three patterns established by this architecture become constitution for future Cowork-aligned projects:

1. **Cost ceilings are enforced at the database, not the UI.** The `briefing_generations` partial unique index is the pattern. Any future "limit N per period" enforcement uses the same shape.
2. **Real-time = Socket.IO + Express, same process.** No microservice split until horizontal scale demands it. Lotview pattern extended.
3. **External system data carries explicit freshness.** Every cached integration row has `fetched_at` + `fetch_status`. C-3 (no invented data) requires this — UI renders "stale" or "failed" based on these fields, never fabricates.

---

**End of architecture v1.**
