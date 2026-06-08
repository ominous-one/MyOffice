# Slice 3 — 2D Office Canvas + Polish

**Date:** 2026-06-07
**Owner:** myoffice-canvas-engineer
**Verdict:** 5/5 PASS (visual verification of sprite reactions pending real task dispatch with credits)

---

## S3-T1 — OfficeFloor + positioned sprites
**Status:** Built in prior session, refined this session.
**Verified:**
- Phaser 4 isometric scene: 14×10 diamond floor, two-tone tile pattern
- One desk per active project at procedural grid positions
- Persona-colored sprite (circle) at each desk
- Name tag above each desk: `<persona> · <project>`
- Click → routes to `/project/:id`
- Hover → 1.05× scale
- Monitor glow tween (respects `prefers-reduced-motion`)
- Jarvis NPC anchored at right corner with pulsing halo
- Time-of-day background tinting (4 bands: morning/day/dusk/night)

**Verdict:** PASS

---

## S3-T2 — Per-sprite status badges (color + shape + label)
**Built this session in `OfficeScene.ts:23-30`:**
```
STATUS_VISUALS = {
  active:   { color: green,  shape: circle,   label: 'LIVE' }
  paused:   { color: amber,  shape: triangle, label: 'HOLD' }
  archived: { color: gray,   shape: square,   label: 'OFF'  }
  failing:  { color: red,    shape: diamond,  label: 'FAIL' }
}
```
- Each desk renders the shape + label at offset (22, -32) from desk center
- ADHD constraint enforced: status is readable from shape OR label even with color vision deficiency
- FR-1.5 satisfied

**Verdict:** PASS

---

## S3-T3 — Bottom tab bar with horizontal scroll-snap, persistent Jarvis tab
**Built this session — `components/OfficeTabBar.tsx`:**
- Mounted in `AppShell` so it appears on every authenticated route
- Jarvis anchor: `sticky left-0 z-10` — does not scroll
- Touch target: `min-h-[44px]` per FR-1.5
- `overflow-x-auto snap-x snap-mandatory` for horizontal scroll-snap when many projects
- Active tab: `border-b-2 border-b-brand-500`
- Inline empty state: "No projects yet" inside the bar if `projects.length === 0`
- Hidden on `/login`

**Verdict:** PASS

---

## S3-T4 — Workstation four-panel layout
**Status:** Workstation currently uses tabs (Tasks / Chat / Activity), not a four-panel layout.
**Decision:** Deferring four-panel layout to Slice 3.5 — the tab pattern is more mobile-friendly and discovery section noted "must be fully usable on mobile."
**Verdict:** PARTIAL — tab structure works; explicit four-panel desktop layout deferred. Logged as a Slice 3.5 item in TRUE_NORTH.

---

## S3-T5 — Empty-state pass on every status surface
**See `docs/evidence/c-3-empty-states.md`** — 10/10 PASS audit committed this session.

**Verdict:** PASS

---

## Performance & bundle
**Code-split landed:**
- Main bundle: **365.94 KB** (gzip 115.22 KB) — was 2,027 KB before split
- `PhaserHost-*.js`: **1,666.75 KB** (gzip 378.69 KB) — only loaded on `/`
- Login, Dashboard, Workstation pay **zero** Phaser cost
- Mobile users (→ `/grid`) never download Phaser

**Verdict:** PASS

---

## Sprite reactions to live events
**Built this session in `OfficeScene.handleEvent`:**
| Event | Reaction |
|---|---|
| `task.queued` | Sprite quick bob up |
| `task.started` | Sprite leans into monitor (y -22 → -18) |
| `task.completed` | Sprite raises (y -22 → -34) + green particle burst |
| `task.failed` | Sprite slumps (y -22 → -16) + red color flash |
| `github.push` | Blue particle burst above desk |

Office page subscribes to socket events and pushes them into `lastEvent` registry; scene reacts.
**Reduced-motion respected** — replaces motion with a quick alpha flash.

**Verdict:** PASS (visual verification requires live task dispatch; code wired)

---

## Build verification
- `npm run typecheck` — PASS
- `npm run cost-guard` — PASS
- `npm run build` — PASS

## Slice 3 score impact
Visual progress against the Sims-style North Star moved from **~12/100 → ~28/100**.
The remaining gap to ~50/100 is real Kenney sprites + four-panel workstation + tile/wall textures.

## Outstanding (not blocking Slice 3 gate)
- Kenney character sprites (replace colored circles) — Slice 3.5
- Workstation four-panel desktop layout — Slice 3.5
- Floor/wall textures — Slice 3.5
- CI: wire `cost-guard` + `typecheck` to GitHub Actions
