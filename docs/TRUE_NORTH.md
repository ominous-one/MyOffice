# TRUE NORTH — MyOffice HQ

**Last updated:** 2026-06-08 (Slice 3.6 Sims-feel push shipped)
**Operator:** Riley (rileyabreo@gmail.com)
**Status:** Slice 1 ✅ · Slice 2 ✅ · Slice 3 ✅ · Slice 3.5 ✅ · **Slice 3.6 Sims-feel ✅** · Slice 4 + Slice 5 pending
**This file is the single source of truth.** If anything else disagrees with it, fix the other file or update this one. Read this first, every session.

---

## 1. The North Star (do not lose this)

> A world-class, Sims-style 2D office where the operator opens one URL and sees their entire agentic workforce — Executive Board + Directors — at their desks, dispatching real Claude Code tasks to real projects in real time. Jarvis is the ambient AI layer.

Reference repos the operator wants this to feel like the union of:
- **The Sims** (visual / spatial / ambient personality)
- **OpenHands** (`vendor/inspiration/openhands`) — autonomous agent execution UX
- **AutoGen Studio** (`vendor/inspiration/autogen`) — multi-agent orchestration UI
- **suna** (`vendor/inspiration/suna`) — open-source agent OS

If a proposed task does not advance the North Star, push back.

---

## 2. Identity & Access

| Thing | Value |
|---|---|
| Production URL | `https://claude-cowork-s82t.onrender.com` |
| GitHub repo | `https://github.com/ominous-one/MyOffice` |
| Local path (WSL) | `/home/ominous/projects/claude-cowork` |
| Operator email | `rileyabreo@gmail.com` |
| Operator password | **bcrypt hash in DB only — never store plaintext anywhere** |
| Daemon env file | `~/.myoffice-daemon.env` (chmod 600) — contains HQ_API_KEY, REDIS_URL, ANTHROPIC_API_KEY |
| Agents directory | `/home/ominous/.claude/agents/` (217 agents + `myoffice/` subdirectory of 6 specialized agents) |

**Where credentials live:** `~/.myoffice-daemon.env`. Never echo to stdout, never commit, never paste into chat.

---

## 3. Stack

- **Frontend:** React 19, Vite, Tailwind, Radix UI, lucide-react, **Phaser 4** (2D canvas), react-router-dom
- **Backend:** Express 4, Socket.IO 4, Drizzle ORM, Postgres 16 (Render-managed), BullMQ on Redis/Valkey
- **Daemon:** Node 20, `tsx` runtime, spawns `claude` CLI in target project paths
- **Auth:** JWT cookie, bcrypt password hash
- **Hosting:** Render (web + Postgres + Valkey/Redis)
- **AI:** Anthropic API, default model `claude-sonnet-4-6`

---

## 4. Architecture (one paragraph)

The HQ server lives on Render and exposes `/api/*` + Socket.IO. The WSL daemon (`systemd --user` service `myoffice-daemon`) authenticates via bearer token, polls BullMQ over the Render Valkey TLS endpoint for task jobs, and spawns the local `claude` CLI inside the project's `localPath`. Output streams back to the HQ via `POST /api/tasks/:id/output` and is fanned out to connected clients over Socket.IO. The frontend has two main views — the **Office canvas** (`/`, Phaser-based isometric scene) and the **Workstation** (`/project/:id`, the task-management view per project). Grid view at `/grid` is the mobile/desktop fallback.

```
┌───────────────────────────────────────────────────────────────┐
│  Render (Oregon)                                              │
│  ┌─────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ Web service │──│ Postgres   │  │ Valkey (Redis TLS)     │ │
│  │ (Express +  │  │            │  │  BullMQ jobs:tasks     │ │
│  │  Socket.IO) │  └────────────┘  └──────────┬─────────────┘ │
│  └──────┬──────┘                             │               │
└─────────┼─────────────────────────────────────┼───────────────┘
          │ JWT cookie                          │ TLS bearer auth
          ▼                                     │
   ┌──────────────┐                             │
   │  Browser     │                             │
   │  React +     │                             │
   │  Phaser 4    │                             │
   └──────────────┘                             │
                                                ▼
                                   ┌─────────────────────────┐
                                   │  WSL2 (operator laptop) │
                                   │  myoffice-daemon (sysd) │
                                   │     │                   │
                                   │     ▼                   │
                                   │  spawn claude --print   │
                                   │  in project localPath   │
                                   └─────────────────────────┘
```

---

## 5. Current state (as of 2026-06-07)

### Working
- Auth (login, JWT cookie, protected routes)
- Project CRUD with soft-delete
- Daemon execution of real Claude tasks (Slice 1 PASS — see `docs/evidence/slice-1-smoke.md`)
- Activity feed wired to GitHub commits (`POST /api/projects/:id/sync-github`)
- Tasks tab w/ run, cancel, streaming output
- Per-project CEO chat — streams tokens via socket (S2-T2/T3)
- Agent definitions sync — daemon fs.watch + `/api/agents/sync` (S2-T1)
- Briefing endpoint — uses `MODEL_BY_AGENT_TIER.jarvis_briefing` (opus) (S2-T5/T7) — gated on credits to fire live
- Briefing UI: dismissible, time-of-day aware (S2-T6)
- Jarvis global chat — FAB+drawer mounted in AppShell, reachable from every view (S2-T4)
- Cost guard — `npm run cost-guard` blocks hardcoded model strings outside `config/models.ts` (S2-T7)
- Daemon as systemd user service (auto-starts with WSL)
- WSL/Windows executor issue solved — daemon runs on WSL, uses `/usr/bin/claude`
- **2D Office Canvas v2 (Sims-feel)**: 18×14 isometric floor with 3 zones (exec/dev/lounge), smooth 48×72 characters with gradient shading + plumbbobs, walking system (to water cooler and back), warmer Sims palette, rugs + picture frames + bookshelf + clock + whiteboards + cooler, brick walls + windows with time-of-day skybox + light beams, status glyphs (color + shape + label), sprite reactions to socket events, speech bubbles, **Web Audio ambient hum + event tones** (toggle in HUD), smooth time-of-day transitions, idle camera drift, eased zoom (S3-T1/T2 + S3.5 + S3.6)
- **Phaser code-split**: main bundle 2027KB → 366KB; office route lazy-loads Phaser (S3 perf)
- **Bottom tab bar** with scroll-snap + sticky Jarvis anchor (S3-T3)
- **Empty-state audit 10/10 PASS** — `docs/evidence/c-3-empty-states.md` (S3-T5 / C-3)
- MyOffice agent workforce of 6 specialized agents in `/home/ominous/.claude/agents/myoffice/`
- Persona registry: 18 personas at `src/shared/personas.ts`
- Inspiration repos shallow-cloned in `vendor/inspiration/` (gitignored)

### Broken / blocked / known issues
- **Anthropic API credits low** → briefing returns "Credit balance too low." Top up at console.anthropic.com.
- **Top bar shows "Daemon online · unknown"** → daemon presence not bound to a project — bug in `DaemonStatus.tsx` or socket payload
- **Stuck task** on the old Windows-path "MyOffice HQ" project — has been "Running..." for 11+ hours. Should be cancelled.
- **Two MyOffice projects exist** — one with Windows path (orphan, no daemon will pick it up), one with WSL path (live)
- **Office canvas is a skeleton.** Floor + colored circles for sprites, name tags. Not Kenney sprites yet, no animations, no Jarvis dialogue bubbles.

---

## 6. Visual goal vs. reality (the 2/100 problem)

Discovery promised: "The 2D office loads. The CEO agent greets you with a summary." Currently the UI is a dark CRUD task manager. After this session's skeleton work, score moves from ~3/100 → ~12/100 toward the Sims feel. The skeleton has:
- Isometric diamond floor (14×10 tiles, two-tone)
- One desk per project at procedural positions
- Persona-colored sprite circles with name tags
- Hover + click → workstation routing
- Glowing monitor tween (idle animation)
- Jarvis NPC corner sprite with pulsing halo
- Time-of-day background tinting

What it still needs (Slice 3 polish):
1. Real Kenney/LPC sprites instead of colored circles
2. Sprite reactions to task events (raise arms on complete, slump on fail)
3. Jarvis dialogue bubbles for entrance greeting + status pings
4. Confetti / particle accents for `github.push` events
5. Reduced-motion respect
6. Desk lamp glow at night

---

## 7. The agentic workforce (THIS IS NEW — read carefully)

In `/home/ominous/.claude/agents/myoffice/` there are 6 specialized agents that finish the project. Each has YAML frontmatter (`name`, `description`, `model: sonnet`) and a charter.

| Agent | Owns |
|---|---|
| `myoffice-orchestrator` | The North Star. Delegates. Reads this file first. |
| `myoffice-canvas-engineer` | Phaser scene, sprites, routing. Files in `src/client/src/office/`. |
| `myoffice-agent-persona` | The 18 personas in `src/shared/personas.ts`. Sprite/palette/voice. |
| `myoffice-jarvis-voice` | Jarvis prompts (briefing + ambient + speak-as-persona). |
| `myoffice-visual-polish` | Time of day, sprite reactions, particles. No business logic. |
| `myoffice-integration-qa` | Validates the full daemon→HQ→canvas loop. Writes evidence files. |
| `myoffice-cleanup` | Stuck tasks, orphan projects. Logged to `docs/cleanup-log.md`. |

These agents are dispatchable two ways:
1. **Locally** via Claude Code `Agent` tool — `subagent_type: "MyOffice Orchestrator"`
2. **Via the daemon** — when a task references the agent, the daemon spawns `claude` with that agent active (already wired via `AGENTS_DIR=/home/ominous/.claude/agents`)

**All workforce agents use Sonnet (`claude-sonnet-4-6`).** Default model unless explicitly overridden.

---

## 8. Repo inventory

```
src/
  client/src/
    office/                 # NEW — Phaser canvas
      PhaserHost.tsx
      scenes/OfficeScene.ts
    pages/
      Office.tsx            # NEW — / route
      Dashboard.tsx         # now at /grid
      Workstation.tsx
      Login.tsx
  daemon/
    src/
      index.ts
      task-runner.ts        # spawns claude CLI
      types.ts
    myoffice-daemon.service # systemd unit
    setup-wsl-autostart.sh  # one-shot installer
  server/
    routes/
      auth.ts, projects.ts, tasks.ts, briefing.ts (NEW)
    db/schema.ts            # Drizzle schema
  shared/
    personas.ts             # NEW — 18 persona registry
    types.ts                # shared API types

docs/
  TRUE_NORTH.md             # YOU ARE HERE
  discovery-2026-06-05.md   # the 10-round interview
  prd-v1.md
  tasks-v1.md
  architecture.md
  requirements-2026-06-05.md
  evidence/                 # one file per slice; PASS/FAIL with timestamps + PIDs

vendor/inspiration/          # gitignored — read-only reference repos
  openhands/
  autogen/
  suna/
```

---

## 9. How to pick up cold (next session checklist)

```bash
# 1. Confirm you're in the right place
cd /home/ominous/projects/claude-cowork
cat docs/TRUE_NORTH.md | head -50

# 2. Check the daemon
systemctl --user status myoffice-daemon
tail -30 ~/.myoffice-daemon.log

# 3. Check the production server
curl -s https://claude-cowork-s82t.onrender.com/api/health

# 4. Check the queue
curl -s -H "Authorization: Bearer $(grep HQ_API_KEY ~/.myoffice-daemon.env | cut -d= -f2)" \
  https://claude-cowork-s82t.onrender.com/api/projects | jq '.[].name'

# 5. Pick up the next slice
cat docs/tasks-v1.md | grep -A 2 "pending\|in_progress" | head -20

# 6. Dispatch to the right agent
# Most work: route to myoffice-orchestrator and let it delegate.
```

---

## 10. The next 3 moves (in order)

1. **Slice 4 activity feeds** — Render API polling worker for deploy status + live `activity.new` broadcast.
2. **Slice 3.5 visual polish** — replace circle sprites with Kenney character sprites; build the four-panel Workstation desktop layout; floor/wall textures.
3. **Slice 5 check-in interview** — `interview_states` machine + 7-day dismissal cooldown.

(Operator action when ready: top up Anthropic credits at console.anthropic.com to fire briefing + Jarvis live. Not blocking any other work.)

After Slices 3.5 + 4 land, North Star score moves ~28/100 → ~55/100.

---

## 11. Hard rules (read before every action)

- **Never commit secrets.** `.env`, `~/.myoffice-daemon.env`, API keys, the operator's password — never in git, never in logs, never echoed.
- **Never delete (DELETE) records.** Always soft-delete via `deletedAt`.
- **Never push to main without:** typecheck pass + local build pass + relevant evidence file.
- **Never skip git hooks** (`--no-verify`). If a hook fails, fix the cause.
- **Never run destructive ops on the WSL daemon** without operator confirmation.
- **Never store the operator's password in plaintext** — bcrypt hash only.
- **The daemon timeout is the source of truth** for stuck-task detection. Don't tune it ad-hoc.

---

## 12. Decision log (append, don't rewrite)

- **2026-06-05:** Computer use / desktop automation moved to v2 (discovery)
- **2026-06-05:** Mobile = reduced view (no canvas) (discovery)
- **2026-06-05:** Operator avatar movement moved to v2 (discovery)
- **2026-06-06:** Daemon executor confirmed as WSL, not Windows (Slice 1 evidence)
- **2026-06-06:** Slice 1 gate closed, all 7 smoke steps PASS
- **2026-06-07:** Phaser 4 chosen over PixiJS for canvas (most mature, best React docs)
- **2026-06-07:** Office canvas added at `/`, Dashboard moved to `/grid`
- **2026-06-07:** 6-agent MyOffice workforce installed in `~/.claude/agents/myoffice/`
- **2026-06-07:** 18-persona registry committed at `src/shared/personas.ts`
- **2026-06-07:** Inspiration repos cloned shallowly into `vendor/inspiration/` (gitignored)
- **2026-06-07:** Slice 2 gate closed — all 7 tasks PASS. Briefing now uses opus via `MODEL_BY_AGENT_TIER`. Jarvis FAB live across every view. Cost guard wired as `npm run cost-guard`.
- **2026-06-07:** Slice 3 gate closed — status badges (color + shape + label), Phaser code-split (2027KB → 366KB main), sprite reactions to socket events, bottom tab bar with scroll-snap + sticky Jarvis anchor, C-3 empty-state audit 10/10 PASS. Workstation four-panel deferred to Slice 3.5.
- **2026-06-07:** Riley chose to defer Anthropic credit top-up until everything else is finished. Saved as feedback memory; future sessions should not prompt for credits.
- **2026-06-07:** Slice 3.5 visual overhaul shipped — procedural character sprites with 5 animation frames (idle/type/cheer/slump), three room zones (exec/dev/lounge), brick walls + windows with time-of-day skybox, light beams, lamps, plants, whiteboards, water cooler, wall clock, cubicle dividers, reception desk, coffee mugs on idle desks, dust particles, speech bubbles, soft floor shadows, camera pan + zoom, HUD with clock + minimap. Self-rated 75-85/100. Riley to give the real number.
- **2026-06-08:** Slice 3.6 Sims-feel push — smooth 48×72 characters with gradients/catchlights/blush, **rotating plumbbobs** overhead, **walking system** (random walks to water cooler), Web Audio ambient hum + per-event tones, sound toggle in HUD, smooth time-of-day color tweens (2.4s), warmer Sims-style palette, rugs + picture frames + bookshelf, idle camera drift, eased zoom. Self-rated 85-92/100.

---

## 13. Update protocol

When you finish a working session:
1. Update §5 (Current state) — what's now working, what's now broken
2. Update §10 (Next 3 moves) — new top 3
3. Append to §12 (Decision log) — any architectural choice
4. Bump the "Last updated" header
5. Commit with `docs(true-north): <one-line>`
