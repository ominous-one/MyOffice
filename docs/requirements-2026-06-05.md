# Requirements — Claude Cowork HQ — 2026-06-05

**Status:** Draft — awaiting CPO review and Chief Architect sign-off
**Source:** Discovery Document `discovery-2026-06-05.md` (operator-approved)
**Prepared by:** Requirements Analyst

---

## 1. Functional Requirements

All requirements trace to the Discovery Document (§ references inline).

### FR-1  HQ Dashboard — 2D Office View

**FR-1.1** — On loading the root URL, the operator sees a 2D office view that displays all registered projects as workstation cards. The view loads and is visually meaningful within 3 seconds on a desktop broadband connection.
_Source: §1 End state, §3 Entry point_

**Acceptance criteria:**
- All registered projects are visible as discrete workstation representations without scrolling (up to 5 projects; layout degrades gracefully beyond 5)
- The view renders in under 3 seconds from navigation start on a desktop connection (measured by Time to Interactive)
- If zero projects are registered, the view shows an empty-state prompt to add the first project

**FR-1.2** — The bottom of the HQ view contains a tab bar with one tab per active project. Tapping a tab navigates to that project's workstation view.
_Source: §3 Navigation_

**Acceptance criteria:**
- Tab bar is always visible and does not scroll off screen
- Maximum of 5 projects represented as tabs in v1; overflow state defined (see Open Questions)
- Active tab is visually distinct from inactive tabs

---

### FR-2  CEO Morning Briefing

**FR-2.1** — On each new session entry, the CEO agent greets the operator with a structured summary of activity since the last session close. The briefing is generated and rendered within 5 seconds of landing on the HQ URL on a 4G connection.
_Source: §3 Entry point, §8 "Proof it's working"_

**Acceptance criteria:**
- Briefing includes: count of completed tasks per project, new commits, deploy events, and any decisions logged since last session close
- Briefing is displayed in the HQ view without requiring the operator to navigate away
- If no activity has occurred since last session, the briefing explicitly states this (no invented content)
- Briefing timestamp is visible so the operator can see how stale it is

**FR-2.2** — The CEO agent model is Anthropic claude-opus (latest available). All other agent interactions default to claude-sonnet-4-6.
_Source: §7 Integrations table_

**Acceptance criteria:**
- CEO briefing requests are routed to the opus model
- Non-CEO agent interactions (project agents, Jarvis queries) use claude-sonnet-4-6
- Model selection is configurable per-agent type in the app configuration (not hardcoded)

---

### FR-3  Project Workstation

**FR-3.1** — Each project has a dedicated workstation view accessible from the tab bar. The workstation shows: task list (done / in progress / blocked / not started), conversation history with the project agent, git activity feed, and deploy status.
_Source: §3 Interaction modes, §4 Data, §8 Primary dashboard_

**Acceptance criteria:**
- Task list renders all four status states with visual distinction
- Conversation history is scrollable and shows all messages in the session history for that project
- Git activity feed shows the last 10 commits with SHA, message, and timestamp (or an empty state if GitHub is not wired)
- Deploy status shows the most recent Render deployment state (or empty state if Render is not wired)
- Workstation loads in under 2 seconds on desktop broadband

**FR-3.2** — The operator can type a task in the workstation task input and submit it. On submission, the task is written to the HQ database with status "queued" and dispatched to the task queue.
_Source: §3 Task dispatch, §7 Option B architecture_

**Acceptance criteria:**
- Task input accepts free-form text with no character limit below 2,000 characters
- On submit, the task appears immediately in the task list with status "queued"
- If the daemon is online, status transitions to "in progress" within 5 seconds of submission
- If the daemon is offline, status remains "queued" with the label "queued — waiting for local agent" visible
- The operator is never presented with a silent failure; every task submission has a visible status

---

### FR-4  Task Dispatch — Local Daemon

**FR-4.1** — A local daemon process runs on the operator's machine. It monitors the Redis queue for new tasks, spawns a real Claude Code session for each task, and streams progress back to the HQ.
_Source: §7 Task dispatch architecture (Option B)_

**Acceptance criteria:**
- Daemon is installed via a single command (e.g., `curl -sSL <url> | bash`)
- Daemon auto-starts on machine boot (launchd on macOS, systemd on Linux)
- Daemon connects to the same Redis instance as the HQ server
- Daemon spawns one Claude Code session per task; concurrent task limit is configurable (default: 1 per project)
- Daemon streams task progress (intermediate output) back to HQ in near-real-time (under 2-second lag per update)
- Daemon writes completion status and final output to the HQ database on task completion

**FR-4.2** — The HQ shows a persistent, unambiguous "daemon offline" indicator when the daemon has not sent a heartbeat within 30 seconds.
_Source: §7 Implication, §9 Edge case 1_

**Acceptance criteria:**
- HQ polls or receives heartbeat from daemon; if heartbeat absent for 30 seconds, "daemon offline" banner appears in the HQ view
- The banner is visible from every view (HQ, workstation, mobile)
- The banner disappears automatically when the daemon reconnects
- Tasks already queued while offline execute in order when the daemon reconnects; no tasks are dropped

**FR-4.3** — The operator can cancel any running task from the HQ at any time. Cancellation stops the Claude Code session within 10 seconds of operator action.
_Source: §9 Edge case 5_

**Acceptance criteria:**
- Every task in "in progress" state has a visible cancel button
- Pressing cancel sends a cancellation signal via the queue; daemon stops the associated Claude Code session
- The task status updates to "cancelled" with timestamp
- Partial output from the cancelled session is preserved and visible in the conversation history

**FR-4.4** — When the daemon encounters an unrecoverable error during task execution, it: (a) stops execution, (b) writes a plain-English explanation of what went wrong, (c) searches online for a solution before giving up, and (d) proposes a revised plan.
_Source: §9 Edge case 5, Self-healing requirement_

**Acceptance criteria:**
- Daemon has access to a WebSearch capability (specific tool TBD — see Open Questions)
- On error, the daemon performs at least one web search before marking a task as failed
- The error explanation, search queries used, and revised plan are written to the task's conversation history and are readable in the HQ workstation
- Task status transitions to "failed" with the explanation visible — never silently disappears

---

### FR-5  Jarvis — Ambient Status Layer

**FR-5.1** — From any view, the operator can type a natural-language question to Jarvis and receive a plain-English answer about the current state of any project or the overall HQ.
_Source: §1 End state (Jarvis), §3 Interaction mode: Ask_

**Acceptance criteria:**
- Jarvis input is accessible from the HQ view and every workstation view without navigating away
- Jarvis can answer questions about: task status, recent activity, project health, what's blocked
- Jarvis responses are grounded only in data from the HQ database and connected integrations — no hallucinated status
- Jarvis response renders within 5 seconds of question submission on a desktop connection

---

### FR-6  Per-Project Check-In Interview

**FR-6.1** — Opening a project workstation presents the operator with a brief structured check-in interview: "what do you want to work on next, what's blocking you?" The interview can be answered, skipped, or deferred.
_Source: §8 Per-project check-in_

**Acceptance criteria:**
- Interview is triggered on each workstation entry when the last interview was completed or is more than 24 hours old
- Interview presents one question at a time
- The operator can answer, skip an individual question, or dismiss the whole interview
- Interview state (current question index, prior answers) persists in the HQ database

**FR-6.2** — If the browser is closed mid-interview, the next session resumes from the last unanswered question, not from scratch.
_Source: §9 Edge case 3_

**Acceptance criteria:**
- Interview progress is saved to the database after each answer or skip action
- On workstation re-entry, if an in-progress interview exists, it resumes at the stored question index
- All prior answers from the same interview session are visible as context above the current question

---

### FR-7  Project Registry

**FR-7.1** — The operator can register a new project by providing: project name, GitHub repo URL, and Render service ID (optional). The project immediately appears in the HQ.
_Source: §4 Project registry_

**Acceptance criteria:**
- Registration form requires only project name and GitHub repo URL; all other fields are optional
- On save, the project appears in the HQ tab bar and workstation list within 1 second
- The HQ accepts projects that are partially complete or in-flight (no completion status required for registration)
- A registered project can only be deleted by an explicit operator action — it is never auto-removed

**FR-7.2** — If a registered project's GitHub repo becomes unreachable (repo deleted, made private, API failure), the project remains in the HQ in a degraded state showing cached last-known data.
_Source: §9 Edge case 2_

**Acceptance criteria:**
- A "GitHub unreachable" indicator is shown on the affected project's workstation and tab
- Cached commit and branch data from the last successful sync is still displayed with a staleness timestamp
- Tasks, conversation history, and checkpoint saves remain fully accessible
- The project is not automatically removed or hidden

---

### FR-8  Checkpoint Saves

**FR-8.1** — The operator can mark a "this is in a good state" checkpoint on any project. The checkpoint is labeled and timestamped.
_Source: §4 Checkpoint saves_

**Acceptance criteria:**
- Operator can create a checkpoint from the project workstation with a required text label
- Checkpoint is stored in the HQ database with: project ID, label, timestamp, git SHA (current HEAD at time of checkpoint), and author
- Checkpoints are listed in chronological order in the project workstation
- Checkpoints are distinct from git commits — they represent operator-curated "known good" states, not every commit
- Architecture decision (git tag vs. DB record vs. both) is resolved before implementation begins (see Open Questions)

---

### FR-9  Persistence and Cross-Device Sync

**FR-9.1** — Task state, conversation history, and interview state persist across browser close, session end, and device switches. No data requiring reconstruction from memory.
_Source: §3 Session end, §4 Task state_

**Acceptance criteria:**
- Task status and history are written to Postgres immediately on change (no in-memory-only state)
- Conversation history per project per agent is stored in Postgres and readable from any device
- A session closed at step N opens at step N on any other device

**FR-9.2** — When the HQ is open on two devices simultaneously, task or status changes on one device appear on the other within 2 seconds via WebSocket.
_Source: §9 Edge case 4_

**Acceptance criteria:**
- HQ server maintains a WebSocket connection to each connected browser session
- Task state changes broadcast to all connected sessions for the same project
- CEO briefing content and interview state sync across sessions
- No stale-read window longer than 2 seconds under normal network conditions

---

### FR-10  Activity Feed

**FR-10.1** — Each project workstation shows a real-time activity feed of commits (from GitHub) and deploy events (from Render). If an integration is not wired, the feed shows an empty state with a setup prompt — never fabricated data.
_Source: §4 Git/deploy activity_

**Acceptance criteria:**
- Activity feed polls GitHub API for commits on the default branch at minimum every 5 minutes
- Activity feed polls Render API for deploy status at minimum every 5 minutes
- Each feed item shows: type (commit/deploy), timestamp, summary text, and status
- Empty state explicitly states which integrations are not yet configured
- Cached feed data is served when the external API is unreachable, with a staleness indicator

---

### FR-11  Mobile View (PWA)

**FR-11.1** — The HQ is installable as a Progressive Web App on mobile. The mobile view shows: reporting dashboard, per-project status, and the check-in interview terminal. The 2D office canvas is not rendered on mobile.
_Source: §6 Risk 3, §8 Mobile view, Decision log_

**Acceptance criteria:**
- The app has a valid PWA manifest and service worker enabling Add to Home Screen installation
- Mobile view renders correctly on viewports 375px–430px wide (iPhone SE through iPhone Pro Max)
- Reporting dashboard on mobile shows task status (done / in progress / blocked / not started) per project without horizontal scrolling
- Check-in interview is fully functional on mobile: question display, text answer input, skip/dismiss
- The operator can dispatch a new task via the mobile chat interface
- The 2D office canvas component is not loaded on mobile (not just hidden — not rendered)
- Mobile view meets a minimum 60fps scroll performance on an iPhone 12 or newer

---

### FR-12  Agent Definitions

**FR-12.1** — Agent personas are sourced from definition files read at HQ startup or daemon startup. The set of available agents and their personas is determined by these files, not hardcoded.
_Source: §4 Agent definitions_

**Acceptance criteria:**
- Agent definitions in `~/.claude/agents/*.md` are read by the daemon at startup and synced to the HQ database
- If no definition files are present, the HQ falls back to a default CEO agent and a default project agent
- Adding or modifying a definition file and restarting the daemon updates the agent roster in the HQ within one session

---

## 2. Non-Functional Requirements

### NFR-1  Performance

| Metric | Target | Condition |
|---|---|---|
| HQ initial load (Time to Interactive) | < 3 seconds | Desktop broadband |
| CEO briefing render | < 5 seconds | 4G mobile connection |
| Workstation load | < 2 seconds | Desktop broadband |
| Cross-device sync lag | < 2 seconds | Normal network conditions |
| Task queue pickup (daemon online) | < 5 seconds | From submission to "in progress" |
| Jarvis response | < 5 seconds | Desktop connection |
| "State of everything in under 10 seconds" | HQ view comprehensible in ≤ 10 seconds | No reading required — visual scan only |

_Source: §2 ADHD design constraint, §3 Session end, §8 CEO briefing_

### NFR-2  Reliability

- Task queue must be durable: tasks written to Redis survive a Redis restart (AOF or RDB persistence enabled)
- The HQ web service must have an uptime SLA commensurate with daily use — Render's standard web service tier is acceptable
- Daemon must auto-restart on crash (managed by launchd/systemd supervisor)
- No task may be silently dropped: every task enters a persistent status (queued / in progress / complete / cancelled / failed)

_Source: §9 Edge cases, §10 Pivot trigger_

### NFR-3  Security

- The HQ URL must not be publicly accessible without authentication. Minimum: HTTP Basic Auth or a single shared secret token checked on every request
- All API keys (Anthropic, GitHub, Render) are stored as environment variables — never in source code or the database in plaintext
- Redis connection between daemon and HQ must use TLS if Redis is exposed over the internet (i.e., not localhost)
- GitHub token is read-only; Render token is read-only; no write operations to external systems in v1

_Source: §2 Anti-persona ("no auth beyond protecting it from the public internet")_

### NFR-4  Accessibility (ADHD-specific)

- The HQ view must communicate the state of all projects through visual hierarchy and color without requiring the operator to read long text
- No auto-playing audio or animation that cannot be dismissed
- Status states (done / in progress / blocked / not started) must be distinguishable by both color and shape/label (not color alone)
- Font size minimum 16px on mobile; touch targets minimum 44x44px

_Source: §2 ADHD design constraint_

### NFR-5  Observability

- HQ application logs must capture: API errors (GitHub, Render, Anthropic), task queue events (enqueue, dequeue, complete, fail), and WebSocket connection events
- Daemon logs must capture: startup, shutdown, task pickup, task completion, task failure, web search invocations
- Log format must be structured (JSON) to enable future filtering
- No third-party logging service required in v1; stdout/file logging is acceptable

### NFR-6  Cost

- Monthly infrastructure cost must not exceed $80 (Render web service + Postgres + Redis + Anthropic API usage)
- CEO briefing (opus model) is called at most once per session entry, not on every page interaction
- Activity feed polling intervals are configurable to allow cost tuning without code changes

_Source: §5 Cost ceiling_

---

## 3. Constraints

**C-1 — Operator-only.** The system is built for exactly one user. No multi-user features, no permissions model, no sharing, no team collaboration. Any architectural decision that introduces multi-tenancy complexity is wrong for this project.
_Source: §2 Anti-persona_

**C-2 — Daemon dependency.** Real task execution is impossible without the local daemon running. The daemon is not optional — it is the core value proposition. Architecture must treat daemon reliability as the highest-priority engineering concern, not an afterthought.
_Source: §7 Option B, §10 Pivot trigger_

**C-3 — No invented data.** No metrics, feed items, task statuses, or agent responses may be fabricated. If a data source is unavailable, show an explicit empty/degraded state. This constraint cannot be relaxed for demo or MVP convenience.
_Source: §4 Git/deploy activity_

**C-4 — Real agent execution.** Dispatching a task must result in a real Claude Code session running on the operator's machine. A task that only writes a todo without executing is a build failure, not a working feature.
_Source: §6 Risk 2_

**C-5 — Infrastructure cost ceiling.** $80/month hard limit. Architectural choices that push the monthly cost above $80 must be flagged and justified before implementation.
_Source: §5 Cost ceiling_

**C-6 — v1 scope lock.** The following are not in v1 under any circumstances: voice, computer use/desktop automation, GoHighLevel integration, OpenHands, operator avatar movement, ElevenLabs. Adding any of these to v1 requires an explicit operator decision to change scope.
_Source: §6 Risk 4, §7 V2 deferred, Decision log_

---

## 4. Data Contract

### Entities

**Project**
```
id:            uuid, primary key
name:          text, not null
repo_url:      text (GitHub repo URL), not null
render_service_id: text, nullable
status:        enum(active, paused, archived), default active
created_at:    timestamptz
last_active_at: timestamptz
github_reachable: boolean, updated on sync
```
Source of truth: HQ DB. GitHub is authoritative for code state within the repo, but the project record itself lives only in HQ DB. Deletes require explicit operator action.

**Task**
```
id:            uuid, primary key
project_id:    uuid, foreign key → Project
title:         text, not null
status:        enum(queued, in_progress, complete, cancelled, failed), not null
created_at:    timestamptz
started_at:    timestamptz, nullable
completed_at:  timestamptz, nullable
error_message: text, nullable
output_summary: text, nullable
```
Source of truth: HQ DB. Never modified by GitHub or Render; only by the HQ server and daemon.

**ConversationMessage**
```
id:            uuid, primary key
project_id:    uuid, foreign key → Project
agent_id:      text (references agent definition name)
role:          enum(user, agent)
content:       text, not null
created_at:    timestamptz
task_id:       uuid, foreign key → Task, nullable (messages may be attached to a task)
```
Source of truth: HQ DB. Immutable after write.

**CheckpointSave**
```
id:            uuid, primary key
project_id:    uuid, foreign key → Project
label:         text, not null
git_sha:       text (HEAD SHA at checkpoint time), not null
created_at:    timestamptz
notes:         text, nullable
```
Source of truth: HQ DB. Whether a corresponding git tag is also created is an open architecture decision (see OQ-1).

**ActivityFeedItem**
```
id:            uuid, primary key
project_id:    uuid, foreign key → Project
source:        enum(github, render)
event_type:    text (e.g., "commit", "deploy_success", "deploy_failed")
external_id:   text (GitHub commit SHA or Render deploy ID)
summary:       text
occurred_at:   timestamptz
fetched_at:    timestamptz
```
Source of truth: Cached from GitHub/Render. Read-only in HQ DB. Stale if external source unreachable.

**InterviewState**
```
id:            uuid, primary key
project_id:    uuid, foreign key → Project, unique
current_question_index: integer, not null, default 0
answers:       jsonb (array of {question_index, question_text, answer_text, skipped})
started_at:    timestamptz
last_updated_at: timestamptz
completed_at:  timestamptz, nullable
```
Source of truth: HQ DB.

**AgentDefinition** (runtime, not DB)
```
Loaded from: daemon filesystem ~/.claude/agents/*.md at daemon startup
Fields parsed: name, persona, model_override (optional), capabilities
Synced to HQ DB: yes — daemon pushes definition list on startup/change
```

### Source-of-Truth Rules

| Data domain | Authoritative source | Fallback |
|---|---|---|
| Code state, commit history | GitHub | HQ DB cached copy |
| Deploy status | Render | HQ DB cached copy |
| Task state, conversation history | HQ DB | None (no fallback — write durably) |
| Project registry | HQ DB | None |
| Agent definitions | ~/.claude/agents/*.md (via daemon) | Default hardcoded agents |
| Interview state | HQ DB | None |
| Checkpoint saves | HQ DB | None |

### Integration Shapes

**GitHub API (read-only)**
- Endpoint: `GET /repos/{owner}/{repo}/commits` — list commits for default branch
- Endpoint: `GET /repos/{owner}/{repo}` — check repo reachability
- Auth: Personal Access Token in Authorization header
- Poll interval: every 5 minutes minimum; configurable

**Render API (read-only)**
- Endpoint: `GET /v1/services/{service_id}/deploys` — list recent deploys
- Auth: Render API key in Authorization header
- Poll interval: every 5 minutes minimum; configurable

**Anthropic API**
- CEO Briefing: claude-opus-latest (or configured opus model ID)
- All other agents: claude-sonnet-4-6
- Auth: ANTHROPIC_API_KEY environment variable

**Redis Queue**
- Task enqueue: HQ server pushes task payload to `tasks:{project_id}` list
- Task dequeue: daemon pops from queue
- Heartbeat: daemon writes to `daemon:heartbeat` key with TTL 30 seconds
- Progress stream: daemon writes to `tasks:{task_id}:progress` stream; HQ server reads and broadcasts via WebSocket
- Schema for task payload: `{task_id, project_id, task_title, project_context, agent_definition}`

---

## 5. Contradictions and Tensions

### CT-1 — Mobile "fully usable" vs. "reduced version" vs. "full parity" ✅ RESOLVED

**Resolution (operator-confirmed 2026-06-05):**
- **Mobile includes:** Reporting dashboard, chat/task dispatch, check-in interview
- **Desktop-only:** 2D office canvas, full workstation detail view
- This is the PRD-ready answer. No further ambiguity.

---

### CT-2 — "Switching computers" vs. daemon bound to one machine (BLOCKER)

**What the Discovery says:**
- §4: "Task state survives browser close, session end, and switching computers"
- §7: "A local daemon running on operator's machine picks up the task"

**The contradiction:** Task state persisting across computers is fully achievable (it's in Postgres). Task *execution* is bound to whichever machine the daemon is running on. If the operator switches from desktop to laptop:
- Task dispatch from the laptop will queue to the daemon on the desktop (if still running)
- If the desktop is off, tasks queue indefinitely
- There is no mechanism defined for running daemons on multiple machines or for transferring a task between daemons

This is not a data persistence problem — it is an execution topology problem. The Discovery treats it as solved by Postgres persistence, but it is not.

**Implication for the PRD:** The PRD must define the daemon topology. Options: (a) daemon runs on one designated primary machine; cross-device means read/write access only, not execution portability; (b) multi-daemon with a claiming mechanism (complex); (c) cloud-hosted execution (removes local daemon entirely, different cost and architecture). Option (a) is the most pragmatic for v1.

**Recommended resolution owner:** Chief Architect.

---

### CT-3 — Agent definitions on `~/.claude/agents/*.md` vs. hosted HQ on Render (BLOCKER)

**What the Discovery says:**
- §4: "Agent definitions: read from `~/.claude/agents/*.md` at startup/build time"
- §7: HQ is hosted on Render

**The contradiction:** `~/.claude/agents/` is a path on the operator's local filesystem. Render's build and runtime environment has no access to it. "Read at startup/build time" is therefore architecturally impossible for a Render-hosted service unless the files are transmitted to the server somehow.

**Implication for the PRD:** The mechanism for getting agent definitions from the local machine to the hosted HQ must be specified. Options: (a) the local daemon reads and syncs them to the HQ DB on daemon startup — this is the most natural fit with the existing daemon architecture; (b) operator manually uploads or commits them; (c) they are entirely static and committed to the repo. Option (a) is the natural path but must be explicitly decided.

**Recommended resolution owner:** Chief Architect.

---

### CT-4 — "No auth beyond protecting from public internet" vs. multi-device access over cellular

**What the Discovery says:**
- §2: "No auth beyond protecting it from the public internet"
- §9 Edge case 4: "Two devices simultaneously… real-time sync"

**The tension:** When the operator accesses the HQ from a mobile device on a cellular network, that request originates from the public internet. "Protecting from the public internet" requires some authentication mechanism — but the Discovery treats this as trivial. The mechanism is not specified.

**Implication for the PRD:** A concrete auth mechanism must be chosen. HTTP Basic Auth with a strong password is the minimum viable approach and is consistent with the single-operator, no-team constraint. But it must be explicitly defined. A session cookie, a shared token, or an IP allowlist each have different tradeoffs on mobile.

**Recommended resolution owner:** CPO (risk acceptance) + Chief Architect (implementation choice).

---

### CT-5 — Daemon is the single point of failure for the entire value proposition

**What the Discovery says:**
- §6 Risk 2 (HIGH): "Real work execution is required — not just task logging. Architecture must wire real Claude Code agent invocation."
- §10 Pivot trigger: "If by day 10 the daemon is unreliable or the operator is opening terminals — stop and diagnose immediately."

**The tension:** The entire value proposition of the product — eliminating terminal friction — depends on a locally-installed background daemon that the operator sets up themselves and that must be running to do anything useful. This is not a contradiction within the Discovery, but it is the highest-risk single dependency in the architecture. The Discovery acknowledges this (it is the explicit pivot trigger) but does not specify:
- What "unreliable" means in testable terms
- What the daemon's recovery behavior is after a crash
- How the operator diagnoses daemon problems from the HQ (not from a terminal)

**Implication for the PRD:** Daemon health monitoring, crash recovery, and self-diagnosis UX must be first-class requirements, not afterthoughts. The pivot trigger is set at day 10 — meaning the daemon must be production-reliable on first install, not "good enough for now."

**Recommended resolution owner:** Chief Architect (reliability design) + CPO (acceptable MTTR definition).

---

## 6. Open Questions

Questions marked **(BLOCKER)** must be resolved before the PRD can be finalized.

**OQ-1 — Checkpoint saves implementation (BLOCKER)**
Git tag, HQ DB record, or both? Each has different implications:
- Git tag only: requires write access to GitHub repo (Discovery says GitHub API is read-only in v1 — direct conflict)
- HQ DB record only: checkpoint is not visible in git history; portable but less useful for code context
- Both: requires writable GitHub access, contradicting v1 read-only constraint unless tags are created by the daemon locally

The read-only GitHub constraint in §7 rules out git tag creation via the GitHub API unless the daemon creates and pushes the tag locally. This architecture decision gates the checkpoint feature implementation.
_Recommended owner: Chief Architect_

**OQ-2 — Daemon topology: one machine or multi-machine? (BLOCKER)**
CT-2 above establishes that execution is bound to the machine running the daemon. The PRD must explicitly state: is task execution pinned to one designated machine, or does v1 support multiple daemons? Multi-daemon support is substantially more complex (task claiming, deduplication, project-to-daemon routing).
_Recommended owner: Chief Architect_

**OQ-3 — Auth mechanism for multi-device access (BLOCKER)**
What is the concrete mechanism for authenticating the operator's mobile device? Options: HTTP Basic Auth, shared API token in URL, session cookie with a simple login page, IP allowlist (impractical on mobile). Must be decided before build.
_Recommended owner: CPO + Chief Architect_

**OQ-4 — Agent definition sync mechanism (BLOCKER)**
How do `~/.claude/agents/*.md` get from the operator's machine to the hosted HQ? The most natural path is daemon-synced on startup. Confirm this is the intended approach; if yes, daemon startup must include a sync step before it begins processing tasks.
_Recommended owner: Chief Architect_

**OQ-5 — CEO agent scope ✅ RESOLVED**
Two-tier model confirmed by operator:
- **Per-project CEO:** Each project workstation has its own CEO agent instance with isolated conversation history scoped to that project
- **Jarvis (master CEO):** A global agent named "Jarvis" with read access to all projects, all task states, all conversation history. Jarvis is the ambient layer — the morning briefing, the cross-project status queries, the "what's going on everywhere" interface. Jarvis is the face of the HQ; per-project CEOs are the workstation experts.
Schema implication: ConversationMessage needs an `agent_scope` field: `enum(project, global)` and a nullable `project_id` for global-scope (Jarvis) messages.

**OQ-6 — Tab bar overflow: what happens with 6+ projects?**
v1 supports 5 projects in parallel. The operator has 6–7 ideas. The HQ should define behavior when more than 5 projects are registered: truncate with overflow indicator, scroll, or enforce a 5-project active limit.
_Recommended owner: CPO_

**OQ-7 — WebSearch tool for daemon self-healing**
The daemon must search online before giving up on a failed task. Which search tool/API is used? Options: Brave Search API, Anthropic web search tool (if available in claude-sonnet-4-6), SerpAPI, direct HTTP to a search endpoint. This affects daemon dependencies and cost.
_Recommended owner: Chief Architect_

**OQ-8 — Interview trigger logic**
FR-6.1 specifies interview triggers when last interview was "completed or is more than 24 hours old." What is the behavior when the operator dismisses an interview entirely without answering? Does dismissal count as "completed" (no trigger for 24 hours) or does it re-trigger on next entry?
_Recommended owner: CPO_

**OQ-9 — Daemon install platform scope ✅ RESOLVED**
Operator confirmed: **Windows only for v1.** macOS/Linux support is v2.
Daemon implications:
- Auto-start mechanism: Windows Task Scheduler or NSSM (Non-Sucking Service Manager) — no launchd, no systemd
- Install script: PowerShell (`.ps1`), not bash
- Process management: Windows Service wrapper or NSSM supervisor
- Chief Architect must validate that Claude Code CLI is available and functional on Windows before committing to the daemon architecture

---

## 7. Out of Scope (v1)

The following are explicitly excluded from v1 by operator decision or project constraint. Any request to include them in v1 requires an explicit scope change decision.

| Item | Reason | Source |
|---|---|---|
| Voice input/output | Explicitly v2 | §3, Decision log |
| Computer use / desktop automation | Explicitly v2 | §6 Risk 4, Decision log |
| GoHighLevel integration | Explicitly v2 | §7 V2 deferred, Decision log |
| OpenHands integration | Explicitly v2 | §7 V2 deferred, Decision log |
| ElevenLabs integration | Explicitly v2 | §7 V2 deferred, Decision log |
| Operator avatar movement in 2D office | Explicitly v2 | Decision log |
| Multi-user / team features | Not in scope ever for this tool | §2 Anti-persona |
| Permissions model / sharing | Not in scope ever for this tool | §2 Anti-persona |
| Velocity metrics, burndown charts, graphs | Not needed per operator | §8 |
| Native mobile app (iOS/Android) | PWA is the mobile approach | §9 OQ-5 |
| Write operations to GitHub (branches, PRs, pushes) | Read-only in v1 | §7 |
| Write operations to Render | Read-only in v1 | §7 |
| Any form of monetization, pricing, or user management | Internal tool only | §5 |
| Investor demo mode / curated fake data | Explicitly prohibited (no invented data) | §4, C-3 |

---

*End of requirements document.*

*Next steps:*
- *CPO: review FRs and contradictions CT-1, CT-4, CT-5 for product decisions*
- *Chief Architect: resolve OQ-1 through OQ-4, CT-2, CT-3, CT-5*
- *Operator: clarify OQ-9 (daemon platform) and OQ-5 (CEO agent scope)*
- *Back to project-interviewer if OQ-9 requires a delta Discovery round*
