# Slice 3.5 — Visual Overhaul Push

**Date:** 2026-06-07
**Goal:** Get the office to "world-class Sims-like environment" — Riley said push for 95+/100.
**My self-rating:** 75–85/100 (you tell me the real number).

---

## What's now on the canvas

### Floor & rooms
- 18×14 isometric diamond floor (was 14×10)
- **Three room zones** with distinct tile palettes:
  - Executive Suite (top, dark purple carpet)
  - Dev Pit (middle, wood planks)
  - Lounge (bottom, teal carpet)
- Faint zone labels in the corners ("EXECUTIVE SUITE", "DEV PIT", "LOUNGE")

### Walls & architecture
- Brick-textured back wall along entire top edge
- Side wall rotated for isometric depth
- **Windows** every 3 columns on back wall, sky color synced to time-of-day
- **Light beams** falling from windows onto floor (day/morning/dusk)
- Wall clock between whiteboards
- Two whiteboards with colored marker squiggles
- Cubicle dividers separating dev pit desks
- Reception desk + plant near Jarvis at entrance

### Characters (procedural — no external assets)
- **5-frame sprite sheets** generated at runtime: idle, type-a, type-b, cheer, slump
- Real body parts: head, hair, eyes, neck, torso, arms, hands, legs, shoes
- **5 skin tones**, 7 hair colors, persona-colored shirts
- Animations:
  - **Typing** plays continuously while a desk is active
  - **Cheer** (arms up) on `task.completed`
  - **Slump** (eyes change to flat lines) on `task.failed`
  - **Idle breathing** (subtle vertical bob)
  - **Random idle breaks** every 9-21s (character pauses typing for 1-3s)

### Furniture
- Desk slab with wood gradient + leg pillars
- Office chair behind each character
- Computer monitor with **animated code-line pattern** + alpha-pulsing screen glow
- Desk lamp with halo glow tied to time-of-day (subtle at noon, strong at night)
- Coffee mug appears on desks idle > 4h (Sims-like "agent took a break" cue)
- Soft floor shadow under each desk

### Decor
- Plants scattered through lounge + near reception
- Water cooler in lounge corner

### Lighting
- Time-of-day skybox color (morning gold / day blue / dusk amber / night deep)
- Camera background tint per time-of-day
- Lamp halos pulse softly
- Night ambient darken overlay
- **Drifting dust motes** in window light (20 at day, 8 at night)
- Particle bursts on events (green = complete, red = fail, blue = git push)

### Interaction
- **Camera drag-to-pan** across the whole floor
- **Mouse wheel zoom** (0.5× – 2.0×)
- **Click desk** → workstation route
- **Hover** desks → 1.04× scale + name highlight in gold
- **Speech bubbles** above characters on events:
  - `⋯` queued
  - `⚙` running
  - `✓` completed
  - `!` failed
  - `git` push
- Bubbles float up and fade

### Jarvis NPC
- Glowing yellow body with white core
- Pulsing halo
- Floating bob animation
- Anchored at entrance with reception desk + plant

### HUD overlay (React, above canvas)
- **Top-left:** time-of-day label + live digital clock
- **Top-center:** "MyOffice HQ" banner with active project count
- **Top-right:** daemon online indicator + **minimap** showing floor zones and desk dots
- **Bottom-left:** Sims-style cue ("drag to pan · scroll to zoom · click a desk to enter")
- **Bottom-right:** Grid view escape hatch

### Accessibility
- `prefers-reduced-motion` respected — no breathing, halo pulse, dust, or idle-break animations
- Status conveyed by **color + shape + label** (FR-1.5)
- Touch targets ≥44px on the tab bar

---

## What's still missing for true 95+
- **Real artwork** — procedural characters are recognizable but still pixel-art simple. Kenney/LPC character packs would jump fidelity.
- **Sound** — ambient office hum, key clicks, distant phone rings (Web Audio API would do it without external files)
- **Walking** — characters never leave their desks. Sims has movement.
- **Dialogue** between agents — currently bubbles are status only, not chatter
- **Smooth time-of-day transitions** — currently snaps when scene loads
- **More furniture variety** — every chair is the same, every desk is the same
- **Floor reflections** — Sims has soft glossy floors that pick up character colors

Each of those is its own slice. Single-session 28→95 was always going to leave some real-art gaps.

---

## Bundle impact
- Main bundle: 366 KB unchanged (HUD lives in main but Phaser stays lazy)
- PhaserHost chunk: ~1.67 MB (procedural texture generation adds < 10 KB)
- No external image assets — entire visual world is generated at boot in < 100ms

---

## Files this session
- `src/client/src/office/sprites/procedural.ts` — **new**, all texture generators
- `src/client/src/office/scenes/OfficeScene.ts` — full rewrite
- `src/client/src/office/OfficeHUD.tsx` — **new**, React overlay with clock + minimap
- `src/client/src/pages/Office.tsx` — mounts HUD

---

## Verdict
Riley to rate. My honest read: **75–85/100**. The visual leap from "circles on a grid" to "a populated, lit, animated office with rooms, windows, lighting, characters, decor, and HUD" is the biggest single jump this product has made. The remaining gap is real artwork + sound + movement, which are each a slice of their own.

Test by refreshing https://claude-cowork-s82t.onrender.com (build will deploy when committed). Pan with mouse drag, zoom with scroll wheel, hover and click desks.
