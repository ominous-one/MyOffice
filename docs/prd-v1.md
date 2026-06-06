# Claude Cowork HQ — Product Requirements Document v1

**Status:** Approved for build
**Date:** 2026-06-05
**Author:** CPO
**Source documents:** `discovery-2026-06-05.md`, `requirements-2026-06-05.md`
**Hands to:** Chief Architect

---

## 1. Overview

Claude Cowork HQ is a single-URL command center that replaces the Claude Code terminal as the operator's primary interface for running multiple software projects in parallel. It is built for one user — Riley — who runs a portfolio of solo-operator products and currently loses context every time he switches projects because the terminal does not remember anything. HQ holds the memory: every project appears as a workstation in a 2D office, a master agent (Jarvis) provides cross-project ambient awareness, per-project CEO agents hold isolated project context, and a local Windows daemon executes real Claude Code sessions dispatched from the browser. The success bar is that by day 10 the operator never opens a terminal again.

---

## 2. Goals and success criteria

### Primary goals
- Replace the Claude Code terminal as the daily driver for managing multi-project work.
- Provide cross-project visibility (via Jarvis) the terminal cannot give.
- Hold all project state — conversations, tasks, checkpoints, activity — so the operator never reconstructs context.

### Success criteria (measurable)

| Horizon | Target | Measurement |
| --- | --- | --- |
| Day 10 | Terminal sessions launched directly by operator drop to zero on three consecutive workdays. | Self-reported, verified by absence of `claude` process started outside the daemon in HQ activity logs. |
| Day 30 | All five current Riley projects registered as workstations and used at least weekly. | Project registry row count ≥ 5; per-project `last_active_at` within 7 days for all. |
| Day 30 | At least 80% of tasks dispatched from HQ reach a terminal state (completed or explicitly cancelled), not orphaned. | Task table query: `terminal_state_count / total_count ≥ 0.80`. |
| Day 30 | Morning briefing opened on ≥ 20 of 30 days. | `briefing_view` event count. |
| Day 90 | Mobile PWA used for at least one check-in or task dispatch per week. | `mobile_session` event present in ≥ 12 of 13 weeks since day 0. |
| Day 90 | Monthly infrastructure cost remains ≤ $80. | Render + Anthropic API billing dashboards. |
| Day 180 | Operator self-reports HQ as "where I work now" in retrospective. | Qualitative; recorded in operator journal. |
| Day 180 | Daemon uptime ≥ 99% over rolling 30-day window. | Heartbeat log: `(minutes_with_heartbeat / total_minutes) ≥ 0.99`. |

### Anti-goals
- Becoming a team tool.
- Becoming a project management product for sale.
- Showing fabricated activity to look impressive.

---

## 3. User persona

Riley is a solo operator running multiple software products simultaneously from Windows machines (one desktop, one laptop, one phone). He has ADHD: context held only in his head evaporates the moment he closes a tab, and when he returns to a project after two days he spends 20–40 minutes reconstructing where he left off. He moves between projects 5–15 times a day. He does not have a team and will never have a team for this tool. He needs the interface to do the remembering for him — when he lands on the URL, the state of every project must be visible from a single visual scan in under 10 seconds, with no reading required. ADHD design constraint is non-negotiable: status must be conveyed by color **and** shape/label (never color alone), fonts on mobile must be ≥16px, and every touch target must be ≥44px. Cognitive load reduction is the product, not a feature.

---

## 4. Architecture overview

### Two-tier agent model

```
                        ┌──────────────────────────────┐
                        │           JARVIS             │
                        │   (master / ambient agent)   │
                        │  Read access: all projects,  │
                        │  all tasks, all history,     │
                        │  all activity feeds.         │
                        │  Writes: briefings, replies. │
                        └──────────────┬───────────────┘
                                       │ cross-project queries
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
   ┌────▼─────┐                  ┌─────▼────┐                   ┌─────▼────┐
   │ CEO: P1  │                  │ CEO: P2  │      ...          │ CEO: Pn  │
   │ Isolated │                  │ Isolated │                   │ Isolated │
   │ context  │                  │ context  │                   │ context  │
   └──────────┘                  └──────────┘                   └──────────┘
```

- **Jarvis** is the HQ landing voice and the morning briefing author. It can read across project boundaries. It cannot dispatch tasks into a specific project unless the operator confirms which project the task belongs to.
- **Per-project CEOs** have isolated conversation histories. CEO of Project A never sees Project B's chats. CEOs author per-project check-in interviews and own the project-detail conversation.

### System components

```
   ┌─────────────────────────────────────────────────────────────────────┐
   │                        BROWSER (desktop + mobile PWA)               │
   │  - 2D office canvas (desktop only)                                  │
   │  - Bottom tab bar (workstations)                                    │
   │  - Workstation detail / chat / task panel                           │
   │  - Mobile reporting view + chat                                     │
   └────────────────────────┬────────────────────────────────────────────┘
                            │ HTTPS + WebSocket
   ┌────────────────────────▼────────────────────────────────────────────┐
   │                       HQ WEB APP (Render)                           │
   │  - Auth gate (shared token or HTTP Basic, see §8 OQ-7-equivalent)   │
   │  - REST + WebSocket API                                             │
   │  - Jarvis + CEO orchestration (Anthropic API calls)                 │
   │  - Reads GitHub + Render status (read-only)                         │
   └─────────┬───────────────────────────────────────────┬───────────────┘
             │                                           │
   ┌─────────▼──────────┐                       ┌────────▼──────────────┐
   │   POSTGRES (Render) │                       │   REDIS (Render)      │
   │  - Projects         │                       │  - Task queue         │
   │  - Tasks            │                       │  - WebSocket pub/sub  │
   │  - Conversations    │                       │  - Daemon heartbeat   │
   │  - Checkpoints      │                       │  - AOF + RDB on       │
   │  - Activity cache   │                       │                       │
   │  - Agent defs       │                       │                       │
   └─────────────────────┘                       └────────▲──────────────┘
                                                          │
                                                  pop / heartbeat / stream
                                                          │
                              ┌───────────────────────────▼────────────────┐
                              │   LOCAL DAEMON (Windows, designated PC)    │
                              │  - Long-poll Redis task queue              │
                              │  - Spawn Claude Code child process per     │
                              │    task in correct project directory       │
                              │  - Stream stdout/stderr back via Redis     │
                              │  - 30-second heartbeat                     │
                              │  - Self-heal: restart on crash via NSSM    │
                              │  - On startup: sync ~/.claude/agents/*.md  │
                              │    to HQ DB                                │
                              └────────────────────────────────────────────┘
```

### Data flow: task dispatch

1. Operator types task in workstation panel.
2. HQ writes `task` row (status = `queued`) and pushes job onto Redis list keyed by project.
3. Daemon pops job, marks `task.status = in_progress`, spawns `claude` child process in project directory.
4. stdout/stderr streamed back via Redis pub/sub channel; HQ relays over WebSocket to browser.
5. Process exit: daemon writes `task.status = completed` (or `failed` / `cancelled`) with full transcript.

### Cross-device behavior

- Designated primary Windows machine runs the daemon. Other devices (laptop, phone) connect to HQ over the web; they read state and can dispatch tasks, but tasks always execute on the primary machine.
- Data writes (chat, task creation, checkpoints) sync across devices via WebSocket within 2 seconds.

---

## 5. Feature specifications

### FR-1: HQ Dashboard — 2D office view + tab bar

**User story.** As the operator, when I land on the HQ URL, I see a 2D office canvas with one workstation per project and a bottom tab bar so that I can pick which project to enter without reading.

**Acceptance criteria.**
1. Desktop landing route renders a 2D canvas with one visible workstation per registered project.
2. Each workstation displays: project name, status badge (color **and** shape/label), and an unread/activity dot if anything changed since operator's last visit.
3. Bottom tab bar shows the same projects as discrete tabs; tapping a tab opens the workstation detail view.
4. Time-to-interactive on desktop broadband ≤ 3 seconds, measured by browser TTI metric.
5. The 10-second visual scan rule holds: no project status requires reading more than a 1-word label to identify.
6. On a fresh account with zero projects, canvas shows an empty-state CTA ("Add your first project") and no fabricated demo workstations.

**Edge cases.**
- More projects than fit the visible canvas: see §8 OQ-6 resolution — overflow scroll horizontally on canvas; tab bar uses horizontal scroll with snap.
- A project whose GitHub repo is unreachable: workstation still renders; status badge becomes `data-stale` shape.
- Mobile devices skip the canvas entirely and render only the tab bar over the reporting view (see FR-11).

---

### FR-2: CEO/Jarvis morning briefing

**User story.** As the operator, when I open HQ for the first time on a given day (or after >6 hours away), I get a Jarvis-authored briefing summarizing what changed across all projects so I can re-enter cold without reconstructing.

**Acceptance criteria.**
1. Briefing is triggered automatically on first session entry after a ≥6-hour gap.
2. Briefing is authored by Jarvis using `claude-opus` model; per-project CEOs supply project-scoped facts.
3. Briefing renders in ≤ 5 seconds measured on simulated 4G (Chrome devtools "Fast 3G" off, "Slow 4G" on).
4. Content includes for each project with activity since last session: completed tasks, new commits, deploy status changes, and any failed task.
5. Briefing is dismissible; once dismissed, it does not re-trigger in the same calendar day unless operator explicitly requests via "Re-run briefing" button in Jarvis panel.
6. Opus is called **at most once per session entry** (cost ceiling enforcement).
7. If no project has activity since last session, briefing renders a single line ("Quiet since yesterday — nothing to report") rather than fabricating content.

**Edge cases.**
- Anthropic API unreachable: briefing area shows a "Briefing unavailable, retry" button; does not block dashboard.
- Operator returns after 5 hours and 59 minutes: no briefing. After 6 hours and 1 minute: briefing.

---

### FR-3: Project workstation detail view

**User story.** As the operator, when I tap into a project workstation, I see that project's task list, conversation with its CEO, git activity, and deploy status on one screen so I have everything I need to work without leaving.

**Acceptance criteria.**
1. Workstation detail loads in ≤ 2 seconds on desktop broadband.
2. Four panels visible without scrolling on a 1440×900 desktop viewport: (a) task list (queued + in-progress + recent completed), (b) conversation pane with project CEO, (c) git activity feed (commits, current branch), (d) deploy status from Render.
3. Task list rows show: title, status badge (color + shape), elapsed time, and a cancel control on in-progress tasks.
4. Conversation pane shows full project-CEO history scrollback; new messages append in real time via WebSocket.
5. Git activity and deploy status panels show "data stale" indicator when last successful poll is > 10 minutes old.
6. Empty project (no tasks yet) renders the panels with empty-state copy; no demo data.

**Edge cases.**
- Project marked as having GitHub unreachable: git panel shows last cached data with timestamp and a "last sync failed" badge.
- Render not configured for a project: deploy panel shows "No deploy target configured" not a fake "healthy" status.

---

### FR-4: Task dispatch + local daemon execution

**User story.** As the operator, when I type a task into a workstation, the local daemon picks it up, runs a real Claude Code session for it, and streams progress back into the browser so I can dispatch real work without opening a terminal.

**Acceptance criteria.**
1. Submitting a task creates a `task` row with status `queued` and writes a job to the Redis queue for that project.
2. With daemon online, time from submission to status `in_progress` is ≤ 5 seconds.
3. Daemon spawns a real `claude` child process in the correct project working directory; mock/stub execution is a build failure (C-4).
4. stdout and stderr stream to the browser via WebSocket; user sees progressive output, not a single blob at the end.
5. Operator can cancel an in-progress task; daemon terminates the child process and writes status `cancelled` with partial transcript.
6. On daemon crash, NSSM restarts within 10 seconds; an in-flight task is marked `failed` with reason `daemon_restart`, never silently dropped.
7. On daemon offline (no heartbeat for >30 seconds), all task submission UIs show a "daemon offline" banner and queue submissions remain in `queued` state for pickup on reconnect.
8. Queue durability: Redis AOF + RDB persistence enabled; restart of Redis does not lose queued tasks.

**Edge cases.**
- Two tasks submitted to same project: executed serially per project to avoid filesystem races.
- Task spawned in a project directory that no longer exists on disk: daemon writes status `failed` with reason `project_path_missing`, surfaces to operator.
- Output exceeds 10 MB: truncated with explicit "[output truncated — full transcript in DB]" marker.

---

### FR-5: Jarvis ambient query layer

**User story.** As the operator, from any view in HQ, I can ask Jarvis a question and get an answer that draws on all projects so I don't have to navigate to find context.

**Acceptance criteria.**
1. A persistent Jarvis input is reachable from every view (floating action button on mobile, sidebar on desktop) with at most one tap/click.
2. Jarvis answers using read access to all project tasks, all conversations, all activity, all checkpoints.
3. Response begins streaming within 3 seconds on desktop broadband.
4. Jarvis can quote specific tasks or commits by ID; when it does, those references render as clickable chips that deep-link into the workstation.
5. If a query is ambiguous about which project it applies to, Jarvis asks a disambiguation question before answering rather than guessing.
6. Jarvis responses persist in a global Jarvis history (separate from per-project CEO histories).

**Edge cases.**
- Operator asks Jarvis to dispatch a task: Jarvis confirms target project, then routes to the FR-4 dispatch flow rather than executing autonomously.
- Operator asks about a project not in the registry: Jarvis answers "I don't have a project by that name" — does not invent one.

---

### FR-6: Per-project check-in interview

**User story.** As the operator, when I enter a project workstation I haven't touched in a while, the project CEO runs a brief check-in interview so I re-orient quickly and the CEO updates its understanding.

**Acceptance criteria.**
1. Check-in interview triggers when the operator enters a workstation whose `last_active_at` is > 48 hours old.
2. Interview is a conversational sequence authored by the project CEO (not Jarvis).
3. Each operator response persists to the conversation history immediately on send (mid-interview survives device switch, browser close, etc.).
4. On re-entry mid-interview, the CEO resumes from the last unanswered question without restarting.
5. Interview completion updates `project.last_checkin_at` and surfaces a one-paragraph synthesis in the workstation header.
6. Operator can dismiss the interview at any time — see §8 OQ-8 resolution: dismissal sets `interview_dismissed_at` and the interview does not re-prompt for 7 days, even on subsequent entries.

**Edge cases.**
- Anthropic API down mid-interview: in-flight answer persists; the next question fetch shows "CEO unavailable, retry" without losing prior answers.
- Interview started on desktop, resumed on mobile: works identically.

---

### FR-7: Project registry (add / edit / delete)

**User story.** As the operator, I can register a new project by pointing HQ at a local directory and a GitHub repo so a new workstation appears in the office.

**Acceptance criteria.**
1. "Add project" form requires: project name, local working directory path (must exist on the daemon host), optional GitHub repo URL, optional Render service ID.
2. On submit, HQ creates the `project` row and the daemon validates the path on next heartbeat; invalid path surfaces inline.
3. Registry degrades gracefully: if GitHub URL is provided but unreachable, project still saves; activity feed for that project will show stale data per FR-10.
4. Edit form allows changing name, GitHub URL, Render service ID; local path is immutable after creation (prevents orphaning task history).
5. Delete requires explicit operator confirmation with the project name typed; only operator can delete (C-1).
6. Deleted projects soft-delete (retained for 30 days) so accidental deletion can be reversed.

**Edge cases.**
- Two projects pointed at the same directory: allowed but flagged with a warning ("shares working directory with X").
- Daemon offline at add time: project saves; path validation deferred until daemon reconnects.

---

### FR-8: Checkpoint saves

**User story.** As the operator, when I reach a moment worth marking ("v1 of inventory grid done"), I can save a labeled checkpoint so I can refer back to where the codebase was at that point.

**Acceptance criteria.**
1. Checkpoint button is available in every workstation.
2. Saving a checkpoint creates a DB row with: project ID, operator-supplied label, git SHA of HEAD at time of save, timestamp.
3. No git tag is written (GitHub is read-only in v1).
4. Checkpoints appear in a project-scoped checkpoint list, sortable by date, with the SHA and label visible.
5. Tapping a checkpoint shows the commit message and changed-files summary fetched live from GitHub (cached 1 hour).
6. Operator can delete checkpoints; no soft-delete (these are bookmarks, low stakes).

**Edge cases.**
- Project has no git repo at the path: checkpoint button disabled with hover tooltip "No git repo detected".
- Daemon offline: checkpoint cannot be saved (HEAD SHA must come from daemon); button shows "Daemon offline, retry".

---

### FR-9: Persistence + cross-device WebSocket sync

**User story.** As the operator, when I take an action on my desktop, the same view on my phone updates within seconds so I never see stale state.

**Acceptance criteria.**
1. All operator actions (chat sends, task creation, checkpoint saves, project edits) propagate to other connected clients within 2 seconds, measured device-to-device on the same LAN.
2. WebSocket reconnection is automatic with exponential backoff; UI shows "reconnecting" indicator while disconnected.
3. On reconnect, client requests delta since last received event ID; no events lost.
4. Conversation pane on a phone shows new CEO messages without manual refresh.
5. Browser closed and reopened reloads full state from DB; no client-side-only state.

**Edge cases.**
- Two devices send conflicting edits to the same project name within the 2s window: last-write-wins, both clients converge to the latest value.
- Mobile device backgrounded: WebSocket may drop; on foreground, full delta resync runs.

---

### FR-10: Activity feed (GitHub + Render)

**User story.** As the operator, I see a feed of real commits and real deploy events per project so I know what actually happened, never what someone made up.

**Acceptance criteria.**
1. HQ polls GitHub for new commits every 5 minutes per registered project; results cache in Postgres.
2. HQ polls Render for deploy status every 5 minutes per project with a configured service; results cache in Postgres.
3. Activity feed renders only real data fetched from the upstream API. Mock / placeholder / demo entries are a build failure (C-3).
4. Each item shows: source (GitHub or Render), event type, summary, timestamp, deep link to source.
5. When an upstream API is unreachable, the feed item area shows the most recent successful cache with a "last sync N minutes ago — failed" badge; it does **not** show fabricated entries.
6. Operator can filter feed by source per project.

**Edge cases.**
- GitHub rate limit hit: HQ backs off, surfaces "rate-limited, next sync in N seconds".
- Render API key invalid: project-level config alert; deploy panel shows "Render auth failed".

---

### FR-11: Mobile PWA

**User story.** As the operator, on my phone I can see the reporting dashboard, dispatch tasks, and do check-in interviews so I can run my projects from anywhere.

**Acceptance criteria.**
1. Installable PWA with manifest, service worker, and home-screen icon.
2. Mobile breakpoints: 375–430px CSS width target.
3. On mobile, the 2D office canvas does **not** load at all (asset not requested, not just hidden).
4. Mobile views included: reporting dashboard (per-project status grid), per-project workstation (chat + task list + dispatch), check-in interview, Jarvis FAB.
5. Mobile views excluded: 2D office canvas, workstation detail four-panel layout.
6. All touch targets ≥ 44×44 px. Body font ≥ 16px. Status uses color + shape/label, never color alone.
7. Works offline for read of last-cached state; writes queue locally and flush on reconnect.

**Edge cases.**
- Tablet (>430px, <1024px): renders mobile layout. Desktop layout begins at ≥1024px.
- Operator on slow connection: skeleton states render within 1s; data backfills as it arrives.

---

### FR-12: Agent definitions synced by daemon

**User story.** As the operator, I edit my Claude agent markdown files locally and HQ picks up the updated definitions automatically so I don't maintain two copies.

**Acceptance criteria.**
1. On daemon startup, daemon reads every `*.md` file under `~/.claude/agents/` and POSTs the contents to HQ.
2. HQ upserts each file into an `agent_definitions` table keyed by filename.
3. On any file change while running, daemon re-syncs that file within 30 seconds (filesystem watcher).
4. HQ exposes agent definitions read-only in a "Workforce" view so operator can see what definitions HQ is using.
5. Per-project CEO and Jarvis prompts pull from synced definitions; out-of-date copy in HQ DB is the visible source of truth.
6. Sync failures surface as an alert in the Jarvis panel ("Agent sync failed: {filename}").

**Edge cases.**
- Daemon offline: HQ uses last successfully synced copy; surfaces "agent definitions may be stale" warning.
- File deleted locally: corresponding `agent_definitions` row marked `deleted_at`; CEOs referencing it surface a "definition removed" error rather than silently using a stale copy.

---

## 6. Out of scope (v1)

Locked. Do not build:

- Voice input or output
- Computer use / desktop automation
- GoHighLevel integration
- OpenHands integration
- ElevenLabs or any TTS
- Operator avatar movement within the 2D office
- Multi-user / collaboration / permissions
- Velocity metrics, burndowns, sprint dashboards
- Native iOS or Android app (mobile is PWA only)
- Write operations to GitHub (no commits, no PRs, no tags)
- Write operations to Render (no deploys, no config changes)
- Monetization, billing, account management
- Fake, demo, placeholder, or mock data in any user-facing surface

---

## 7. Technical constraints

Verbatim from requirements:

- **C-1: Operator-only.** No multi-user features ever.
- **C-2: Daemon reliability = highest-priority engineering concern.**
- **C-3: No invented data. Empty states only. Non-negotiable.**
- **C-4: Real Claude Code execution. Task logging alone = build failure.**
- **C-5: $80/month ceiling.**
- **C-6: Voice, computer use, GoHighLevel, OpenHands, avatar movement — v2, locked.**

---

## 8. Open questions remaining

These must be resolved by the Chief Architect during system design, not left open for engineers.

### OQ-6: Tab bar overflow behavior at >7 projects

**Decision required:** The bottom tab bar has finite horizontal space. At >7 projects the tabs cannot all fit without shrinking below the 44px touch target.

**Resolved direction (for architect to confirm or counter):** Horizontal scroll with CSS scroll-snap, preserving the 44px target. The 2D canvas itself also scrolls horizontally so the operator's visual model (office → tab bar) stays consistent. A persistent "Jarvis" tab anchors at the left edge and does not scroll out of view. If the architect identifies a measurable UX failure at >12 projects, escalate to CPO for a re-think (e.g., grouping or a "more" overflow menu).

### OQ-7: WebSearch tool availability for daemon-spawned Claude Code sessions

**Decision required:** Whether the `claude` child processes spawned by the daemon have the WebSearch tool enabled by default, only on opt-in per task, or never.

**Resolved direction:** Enabled by default. Tasks that require fresh information (docs, error lookups, library versions) are common enough that disabling-by-default creates friction. Cost impact is bounded by C-5 and Anthropic's own per-task limits. Architect must implement a per-project override flag (`websearch_enabled: bool`, default true) in `project` table so operator can disable for sensitive projects.

### OQ-8: Check-in interview dismiss behavior

**Decision required:** When the operator dismisses a check-in interview mid-flow, does it resume next time, restart next time, or stay dismissed?

**Resolved direction:** Dismissal sets `interview_dismissed_at` on the project. The interview does not re-prompt for 7 days, regardless of how many times the operator enters that workstation. After 7 days, the next entry re-triggers a fresh interview (not a resume of the dismissed one — context is too stale). The operator can manually run a check-in interview at any time from a "Run check-in" button in the workstation header.

---

**End of PRD v1.**
