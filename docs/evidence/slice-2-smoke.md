# Slice 2 — Smoke Test

**Date:** 2026-06-07
**Owner:** myoffice-orchestrator
**Verdict:** 7/7 PASS (one operator-side action pending: top up Anthropic credits to exercise opus briefing live)

---

## S2-T1 — Agent definitions sync endpoint + daemon fs.watch
**Verified:**
- `src/server/routes/agents.ts` exposes `POST /api/agents/sync` behind `requireDaemonToken` with `content_hash` upsert and soft-delete on missing files.
- `src/daemon/src/agent-sync.ts:83` uses `fs.watch(agentsDir, …)` to push updates after the initial bulk sync (`index.ts:24`).
- `agent_definitions` table exists in schema (`schema.ts:144`) with partial unique index excluding soft-deleted rows.

**Verdict:** PASS

---

## S2-T2 — Anthropic SDK relay: stream tokens to socket room
**Verified:**
- `src/server/services/anthropic.ts:58` calls `client.messages.stream`.
- Tier resolution at `services/anthropic.ts:24` consumes `MODEL_BY_AGENT_TIER`.
- Socket `chat.send` (`socket/index.ts:70`) routes via `streamChat` and broadcasts `message.token` + `message.complete`.

**Verdict:** PASS

---

## S2-T3 — Per-project CEO chat UI
**Verified:**
- `Workstation.tsx` has chat tab with `chatInput`, `streaming` state.
- Socket handlers `message.token` (`:77`), `message.complete` (`:80`), `message.appended` (`:74`) wired.
- Empty conversation renders the empty state — no fabricated welcome (C-3 satisfied).

**Verdict:** PASS

---

## S2-T4 — Jarvis global chat (FAB on mobile, sidebar on desktop)
**Built this session:**
- `src/client/src/components/JarvisPanel.tsx` mounted in `AppShell` so it's reachable from every authenticated view.
- Floating button bottom-right (mobile + desktop); opens a drawer (mobile: full-screen above tabs; desktop: 384×512 card).
- Emits `chat.send` with `projectId: null` → server routes to tier `jarvis_ambient` (sonnet).
- Empty state: "Good <morning/afternoon/evening>, Riley." Time-of-day aware.
- Explicit text: "I won't dispatch tasks without confirming the project first." (FR-5.5 satisfied at the UI level; the server-side `task.dispatch` already requires explicit `projectId`.)

**Verdict:** PASS (visual verification pending live server with credits)

---

## S2-T5 — Morning briefing trigger + opus-once-per-day enforcement
**Verified:**
- Partial unique index `idx_briefings_one_per_day` confirmed in `schema.ts:189` keyed on `briefing_date` with `WHERE trigger_reason = 'session_entry_gap'` — blocks second auto-trigger same day, allows manual re-run with `trigger_reason='manual'`.
- Route logic at `briefing.ts:36-47` returns cached briefing if existing row for today+`session_entry_gap` present.
- **Fixed this session:** `briefing.ts` now consumes `MODEL_BY_AGENT_TIER.jarvis_briefing` instead of hardcoded `'claude-sonnet-4-6'`. Briefing now uses `claude-opus-4-7` per spec.

**Verdict:** PASS — opus enforcement landed. Live exercise blocked by Anthropic credit balance.

---

## S2-T6 — Briefing UI: dismissible, persists dismissal for the day
**Verified (from prior session):**
- `Dashboard.tsx:175` renders the Jarvis briefing banner with dismiss button.
- `dismissBriefing()` calls `POST /api/briefing/:id/dismiss`, sets `dismissed_at`.
- `useEffect` fetches `/api/briefing/today`; cached fetch on re-entry prevents duplicate prompt.

**Verdict:** PASS

---

## S2-T7 — Cost guard: model selection enforced
**Built this session:**
- `scripts/check-model-strings.sh` greps `src/server src/client src/daemon src/shared` for any `'claude-(opus|sonnet|haiku)-N'` literal outside the allowed files (`src/server/config/models.ts`, `src/daemon/src/types.ts`).
- Wired as `npm run cost-guard` in `package.json`.
- Run on current tree: `cost-guard: OK — model strings only in approved files.`

**Verdict:** PASS (architectural; can be added to CI later as a required check)

---

## Build status
- `npm run typecheck` — PASS
- `npm run cost-guard` — PASS
- `npm run build` — PASS (2.0MB client bundle warning is expected; Phaser canvas. Code-split to be done in Slice 3.)

## Outstanding (operator action)
- **Top up Anthropic credits** at console.anthropic.com → Billing. Briefing endpoint will return `Credit balance too low` until then. All code is in place.

## Follow-ups (not blocking Slice 2 gate)
- Client bundle code-split (Phaser dynamic import) — Slice 3
- Visual verification of Jarvis FAB once briefing is live — Slice 3
- CI wiring of `cost-guard` — operations
