# Discovery — Claude Cowork HQ — 2026-06-05

*Status: Complete — awaiting operator approval*

---

## 1. Goals

**End state (12 months):** Open one URL, see all active projects as "workstations," dispatch new work to each, run 5 projects in parallel, and watch real-time progress. Jarvis is the ambient layer — you ask it for status updates and it answers.

**The actual problem today:** Two things — (1) friction of proper Claude Code setup per session, and (2) no centralized view of what's happening across projects. Every project lives in its own terminal context; there's no single place that shows "where are all five projects right now?"

**Offensive or defensive:** Offensive — this is new ground, not a replacement for something broken.

**6-month canary:** Can open the URL and dispatch real work to at least 3 active projects without opening a terminal. Jarvis gives a meaningful status update on demand.

**Explicit non-goal:** Not for anyone but the operator (Riley). Not a team tool. Not a project management SaaS. Not a demo for investors.

## 2. Users

**Primary user:** Riley (operator). Solo. No team.

**Profile:** Has ADHD. Juggles 6-7 project ideas but can only sustain 1-2 at a time. No current PM tool — project state lives entirely in memory. Projects are scattered across multiple computers and GitHub repos, not consolidated anywhere.

**Device:** Both mobile and desktop. Must be fully usable on mobile (not just "responsive" — actually useful on a phone screen).

**Today's workflow without this product:** Open a terminal, remember which project was last touched, try to reconstruct context from git history or open files, start a new Claude Code session, re-explain what was already decided. Repeat. High cognitive overhead on every context switch.

**The core ADHD design constraint:** The interface has to do the remembering. Low cognitive load on entry — the user should be able to land on the URL and understand the state of everything in under 10 seconds without reading anything long.

**Anti-persona:** Anyone else. This is not a multi-user tool. No auth beyond protecting it from the public internet. No sharing, no permissions model, no team features.

## 3. Workflow

**Entry point:** Open the URL. The 2D office loads. The CEO agent greets you with a summary of what's changed since your last check-in (completed tasks, deploys, commits, decisions).

**Navigation:** Bottom tab bar, one tab per active project. Click a tab → opens that project's workstation. The 2D office is the HQ view; workstations are project-specific views.

**Interaction modes (v1):**
- **Ask** — query Jarvis for a status update or question
- **Type** — send a task or message to a project's agent context
- **Report** — view what's been done, what's in progress, what's blocked
- **Voice** — explicitly v2

**Task dispatch:** User types a task into the workstation. The system logs it and begins work (dispatches to the relevant agent/Claude Code context).

**Session end:** Everything is saved — task state, conversation history, project context. Next session, the CEO picks up from the last known state. No reconstruction required.

**Frequency:** Daily. First thing in the morning and whenever context-switching between projects during the day.

**Artifact left per session:** Updated task list + conversation log per project. CEO summary on next entry.

## 4. Data

**Project registry:** Currently lives only in Riley's head + scattered files across multiple computers. No canonical list exists. The HQ becomes the canonical home. Projects are pushed to GitHub; the HQ reads from GitHub repos. **Important:** many current projects are ~70% finished, not clean or complete — the HQ must handle partial/in-flight project state gracefully.

**Checkpoint saves:** User wants the ability to mark a "this is in a good state" snapshot on a project — likely implemented as a git tag or a named savepoint record in the HQ database. This is a distinct concept from a regular commit. (Needs architecture decision: git tag vs. HQ DB record vs. both.)

**Task state (TodoList):** Must persist across sessions. The HQ database is the persistent home. Task state survives browser close, session end, and switching computers.

**Conversation history:** Persists per project. Readable in the workstation. Must survive sessions and be accessible from any device.

**Git/deploy activity:** Real data only. Pull from GitHub (commits, branch state) and Render (deploy status, health). No fake metrics. Empty state if not wired, not invented data.

**Agent definitions:** Read from `~/.claude/agents/*.md` at startup/build time. These are the source of truth for which agents exist and their personas.

**Data that lives in the HQ database (Postgres):**
- Project registry (name, repo URL, status, created, last active)
- Tasks (per project, status, created, completed)
- Conversation history (per project, per agent)
- Checkpoint saves (per project, label, timestamp, git SHA)
- Activity feed (commits, deploys — cached from GitHub/Render)

**Source of truth conflicts:** GitHub is authoritative for code state. HQ DB is authoritative for task state and conversation history. If they disagree, GitHub wins on code; HQ DB wins on tasks/conversations.

## 5. Monetization

**Model:** None. Internal tool, operator-only. No pricing, no users, no revenue.

**Cost ceiling:** $30–80/month is acceptable. Stack should not be over-engineered for cost, but should not be wasteful either. Render (web service + Postgres + Redis) + Anthropic API calls is the expected cost profile.

**Strategic intent (confirmed by operator):** This is infrastructure for the operator's own productivity. Value is measured in projects shipped, not dollars earned.

## 6. Risks

**Risk 1 — Project onboarding friction:** Operator is confident they can migrate all scattered projects in one afternoon. Not considered a blocking risk.

**Risk 2 — "It does the work" expectation gap (HIGH):** The operator explicitly requires real work execution — not just task logging. If dispatching a task only writes a todo that the operator still has to run manually, the tool is useless. Architecture must wire real Claude Code agent invocation. This is the single highest-stakes technical decision in v1.

**Risk 3 — Mobile becomes an afterthought:** Accepted tradeoff. Desktop-first for v1. Mobile gets a reduced version (chat + status, no 2D canvas) until it can be properly built. Not a blocker.

**Risk 4 — Computer use / desktop automation (DEFERRED TO V2):** Operator wants the HQ to control the desktop and automate tools like GoHighLevel (B: computer use API, C: OpenHands-style code execution). This is architecturally complex from a hosted server — requires either a local bridge daemon or a cloud VM. Explicitly moved to v2. V1 ships without it.

**V1 scope confirmed:** HQ + 2D office + project workstations + agent chat + real Claude Code task dispatch + task/conversation persistence + git/Render activity feed + CEO morning briefing. World-class execution on these. Desktop automation is v2.

## 7. Integrations

**V1 required integrations:**

| System | Role | Notes |
|---|---|---|
| **Anthropic API** | Agent chat, CEO briefing, task reasoning | Existing key. claude-sonnet-4-6 default, opus for CEO |
| **GitHub API** | Commit history, branch state per project | Personal access token. Read-only for v1 |
| **Render API** | Deploy status, service health per project | Read-only for v1 |
| **Local agent daemon** | Real Claude Code task execution on operator's machine | See architecture below |

**Task dispatch architecture (confirmed: Option B):**
1. Operator types a task in the HQ workstation and submits
2. HQ writes the task to a Redis queue
3. A **local daemon** (lightweight process running on operator's machine) picks up the task from the queue
4. Daemon spawns a real Claude Code session with the task and project context
5. Progress and completion status flow back to the HQ via the queue / WebSocket
6. HQ updates the task board and activity feed in real time

**Implication:** The local daemon must be running on the operator's machine for tasks to execute. The HQ shows a clear "daemon offline" state when it isn't. The operator installs the daemon once; it runs in the background.

**V2 integrations (deferred):**
- GoHighLevel (computer use / browser automation)
- ElevenLabs (voice)
- OpenHands (autonomous code execution environment)

## 8. Reporting

**Primary dashboard (desktop):** All projects in one view — completion status, what's done, what's next. Quick visual scan tells you the state of everything without opening any project.

**Per-project check-in (key UX pattern):** Opening a project triggers a brief structured interview — "what do you want to work on next, what's blocking you?" — similar to the discovery interview format. The operator can answer and advance, or skip and come back later. This is the core interaction model, not just a task list.

**Mobile view:** Reporting dashboard + chat/interview terminal only. No 2D office canvas. Full parity on the check-in interview and project status. Read-only for task state; can dispatch new tasks via chat.

**"Proof it's working" moment:** CEO morning briefing summarizes: X tasks completed across Y projects since last check-in. If that number is non-zero, the tool is earning its pixels.

**What's explicitly NOT needed:** Charts, graphs, velocity metrics, burndown charts. Just clear state: done / in progress / blocked / not started.

## 9. Edge cases

**1. Daemon offline:** Task is queued with a visible "queued — waiting for local agent" status. Executes automatically when the daemon reconnects. Never silently dropped.

**2. GitHub repo gone/private:** Project does NOT disappear from the HQ. Only the operator can delete a project. If the GitHub source becomes unreachable, the project shows a degraded state (cached last-known data, git activity paused) with a clear indicator. Operator deletes projects manually; GitHub state does not auto-delete them.

**3. Mid-interview browser close:** Interview state persists in the database. Next session resumes from the last unanswered question — not from scratch.

**4. Two devices simultaneously:** Real-time sync across all open sessions via WebSockets. Task dispatched on phone appears immediately on laptop. No stale state between devices.

**5. Task errors during execution:** Dual cancellation model:
- Operator can cancel any running task from the HQ at any time
- The agent (Claude Code daemon) can self-cancel if it detects an unrecoverable error — it stops, writes a plain-English explanation of what went wrong, and proposes a revised plan
- **Self-healing requirement:** When the daemon hits an error it can't solve from context alone, it must search online for solutions before giving up. WebSearch is a required capability of the daemon, not optional.

## 10. Success metrics

**Day 10:** Never open a Claude Code terminal again. The HQ is the only interface needed to dispatch, monitor, and interact with agents across all projects. If the operator is opening a terminal, v1 has failed.

**30 days:** At least 3 previously stalled 70%-done projects have moved forward with real completed tasks. CEO morning briefing is the first thing opened every morning.

**90 days:** At least one previously stalled project has shipped. No raw terminal usage. All project context lives in the HQ — no reconstruction from memory or scattered files.

**180 days:** The HQ is the operating system. Multiple projects in flight simultaneously. The "I have 6 ideas but only work on 1" problem is solved because the HQ holds the others in state until you're ready.

**Pivot trigger:** If by day 10 the daemon is unreliable or the operator is still opening terminals to get real work done — stop, diagnose immediately. The entire value proposition depends on the daemon working seamlessly.

---

## Open questions

1. **Checkpoint saves implementation:** Git tag vs. HQ DB record vs. both? Chief Architect to decide.
2. **Daemon install UX:** How does the operator install and start the local daemon? One-command install script required. Daemon must auto-start on machine boot.
3. **Agent persona mapping:** The 2D office shows the Executive Board + 14 Directors (18 total). How are these mapped to actual project workstations? Does each project get its own CEO instance, or is the CEO shared across all projects?
4. **Interview persistence format:** What does "resume from last unanswered question" look like in the DB schema? Needs to store question index + prior answers per project.
5. **Mobile app vs. mobile web:** Is the mobile lesser version a PWA (Progressive Web App) or a separate native app? PWA is strongly recommended for v1 — no app store submission required.

## Decision log

- **2026-06-05:** Computer use / desktop automation (GoHighLevel, OpenHands) moved to v2. V1 ships without it.
- **2026-06-05:** Voice input/output moved to v2 explicitly.
- **2026-06-05:** Operator avatar movement in 2D office moved to v2.
- **2026-06-05:** Task dispatch confirmed as Option B — local daemon picks from Redis queue and runs real Claude Code sessions.
- **2026-06-05:** Mobile confirmed as reduced version — reporting + chat/interview only, no 2D canvas.
- **2026-06-05:** Self-healing confirmed: daemon must search online for solutions before giving up on a failed task.
- **2026-06-05:** Success bar set at Day 10: never open a Claude terminal again.
