# Slice 3.6 — Sims-Feel Push

**Date:** 2026-06-08
**Trigger:** Riley: "this is 2d video game vibes. keep going so you can make it 95+/100 yourself."
**My self-rating after this pass:** 85–92/100 (still your call).

---

## What changed vs. Slice 3.5

### Character rendering — smooth, not pixel
Old: small (32×48) pixel-art rects, hard edges, simple eyes-as-circles.
New (**48×72**, all in `procedural.ts` `drawSimsCharacter`):
- Rounded shapes everywhere — `fillEllipse`, `fillRoundedRect`, `fillCircle` (anti-aliased on canvas)
- **Gradient shading** on torso (highlight top, shaded right side), face (skin lighten/darken), hair (bright top), pants
- **Eye catchlights** — tiny white reflection dot in each eye (Sims trademark)
- **Frame-specific eye styles** — flat lines when slumping, curved `^^` when cheering, dots+catchlight normally
- **Cheek blush** added on cheer frame
- 5 skin tones, 8 hair colors, 4 pants colors, persona shirt colors
- Soft elliptical drop shadow at feet
- Hand spheres with shading
- Hair has a brighter highlight stroke
- 7 frames now: idle, type-a, type-b, cheer, slump, walk-a, walk-b

### Plumbbob — the Sims signature
- Procedural diamond above each character's head
- Top half lighter, bottom half darker (faceted look)
- Central vertical highlight line
- Outer additive halo
- **Rotates 360° every 4.5s** + **floats up/down** every 1.8s
- Tinted to persona palette color
- Additive blend mode → glows

### Walking system
- Every 18s, a random non-walking character has 50% chance to get up
- Walks to water cooler corner over 3.2s with `walk-a/walk-b` animation cycling
- Pauses 1.8s at cooler (idle frame)
- Walks back home over 3.2s
- Container Y is dynamically updated → proper depth-sorting during walk
- Returns to typing animation when home
- All animations gated on `prefers-reduced-motion`

### Sound — Web Audio API (zero external files)
- **Brown noise ambient hum** via random buffer + lowpass filter @ 220 Hz
- **Per-event tones**: queued (660Hz sine), started (540Hz triangle), completed (880Hz sine), failed (220Hz sawtooth), git (720Hz square)
- 35ms exponential decay envelope, 6% gain
- AudioContext lazily initialised on first user gesture (browser autoplay rules)
- HUD toggle: persisted to `localStorage.office.audio`
- Volume tweens smoothly when toggled

### Smooth time-of-day transitions
- Background color **tweens over 2.4s** (was a hard snap)
- Ambient overlay alpha tweens
- Watcher runs every 30s; only fires when band changes (morning/day/dusk/night)

### Warmer Sims-style palette
- Exec carpet: warm purple velvet (was dark muddy purple)
- Dev floor: warm oak planks (was muddy brown)
- Lounge: warm forest green (was teal)
- Zone labels: gold text (was gray)
- Ambient backgrounds: warmer at all hours

### New decor
- **Exec rug** (purple + gold) under exec desks, slight rotation
- **Lounge rug** (green + cream) in lounge, opposite rotation
- **Picture frames** with abstract art (3 colors) between windows
- **Bookshelf** with multi-color book spines in exec corner
- More plants (added 2 spots)

### Smoother existing assets
- Desk: wood grain lines, front shading, rounded legs
- Chair: 5-star base via ellipse, headrest highlight
- Monitor: rounded bezel, 3-color code lines, screen reflection, stand with elliptical base
- Plant: layered ellipse leaves, soil ellipse, pot rim
- Lamp: faceted shade, gradient, stem
- Whiteboard: thicker frame, marker tray with 3 colored markers
- Cooler: bottle shine, blue/red taps, drip pan
- Windows: cloud accents on sky, gradient sky, mullions
- Bubble: shadow + inner highlight, smoother corners
- Mug: arced handle (not rect), steam dots
- Clock: red center hub, gradient face

### Camera idle drift
- Subtle 4px horizontal sway every 8s when user not interacting (kills "static" feel even with no events)
- Wheel zoom now eased (220ms cubic easing) instead of instant snap

### HUD audio toggle
- Top-right button: `Volume2`/`VolumeX` icon + "Sound on/off" label
- Persisted in localStorage
- Passes through `Office.tsx → PhaserHost → registry → OfficeScene.setAudioEnabled`

---

## Verifications
- `npm run typecheck` ✅
- `npm run cost-guard` ✅
- `npm run build` ✅ (main 366 KB, PhaserHost chunk grew slightly to ~1.7 MB due to richer procedural draws — still lazy-loaded)

## Files this slice
- `src/client/src/office/sprites/procedural.ts` — full rewrite (smooth shapes, plumbbob, rug, picture frame, bookshelf)
- `src/client/src/office/scenes/OfficeScene.ts` — rewrite (walk system, sound, smooth ToD, warmer palette, new decor)
- `src/client/src/office/PhaserHost.tsx` — audio prop pass-through
- `src/client/src/office/OfficeHUD.tsx` — audio toggle button
- `src/client/src/pages/Office.tsx` — audio state + localStorage

---

## Honest gap analysis (what blocks 95+)
1. Character art is still procedural — true Sims uses 3D meshes; we're closer but still 2D
2. Walking pathing is straight-line (not isometric-aware) — characters might cross diagonals through walls if positioned wrong
3. Characters always face the same direction (no left/right walking sprite)
4. Floor tiles are still flat-color (no real wood grain / carpet weave at tile level)
5. No actual furniture variety — every desk identical
6. No environmental storytelling (nothing on screens specific to that project)

Each of those is a separate slice. The current state is "we built a recognizable, animated, audio-enabled isometric office" — not Stardew, not Sims-3D, but somewhere between Sims 1 and Stardew aesthetically.

---

## Verdict
Refresh the deployed site, pan/zoom around for 30s with sound on. Watch a character walk to the cooler. Tell me your number.

If you say **<85**: I'll push another slice on left/right walk sprites + furniture variety.
If you say **85–94**: I'll polish the specific things you call out.
If you say **95+**: done; we move to Slice 4 (Render polling) and Slice 5 (check-ins).
