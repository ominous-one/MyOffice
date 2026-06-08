import Phaser from 'phaser'

export const CHAR_FRAME_W = 48
export const CHAR_FRAME_H = 72
export const CHAR_FRAMES = 7 // 0 idle, 1 type-a, 2 type-b, 3 cheer, 4 slump, 5 walk-a, 6 walk-b

const SKIN_TONES = [0xfcd7b6, 0xeac086, 0xc68642, 0x8d5524, 0xffe0bd]
const HAIR_COLORS = [0x2b1d0e, 0x4a2c0e, 0x6b3e10, 0x8b4513, 0xa66a3a, 0xc9a165, 0x1a1a1a, 0xb91c1c]
const PANTS_COLORS = [0x1f2937, 0x312e81, 0x422006, 0x4c0519]

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

function darken(color: number, amt: number) {
  return Phaser.Display.Color.IntegerToColor(color).darken(amt).color
}

function lighten(color: number, amt: number) {
  return Phaser.Display.Color.IntegerToColor(color).brighten(amt).color
}

interface CharOptions {
  shirt: number
  skin: number
  hair: number
  pants: number
  frame: number
}

function drawSimsCharacter(g: Phaser.GameObjects.Graphics, ox: number, opts: CharOptions) {
  const { shirt, skin, hair, pants, frame } = opts
  const cx = ox + CHAR_FRAME_W / 2
  const baseY = CHAR_FRAME_H - 4

  // Frame-dependent
  const armSwingL = frame === 1 ? -2 : frame === 2 ? 2 : frame === 5 ? -4 : frame === 6 ? 4 : 0
  const armSwingR = -armSwingL
  const armUpper  = frame === 3 // cheer raises arms
  const slump = frame === 4
  const walk = frame === 5 || frame === 6
  const headBob = walk ? (frame === 5 ? -1 : 1) : (frame === 3 ? -3 : slump ? 3 : 0)
  const torsoTilt = slump ? 2 : frame === 3 ? -1 : 0

  // ─── Soft drop shadow ─────────────────────────────────────────────────────
  g.fillStyle(0x000000, 0.32)
  g.fillEllipse(cx, baseY + 2, 22, 6)

  // ─── Legs ────────────────────────────────────────────────────────────────
  const legOffL = walk ? (frame === 5 ? -2 : 2) : 0
  const legOffR = -legOffL
  // Left leg
  g.fillStyle(pants)
  g.fillRoundedRect(cx - 9 + legOffL, baseY - 22, 7, 22, 3)
  // Right leg
  g.fillRoundedRect(cx + 2 + legOffR, baseY - 22, 7, 22, 3)
  // Pants shading
  g.fillStyle(darken(pants, 12))
  g.fillRoundedRect(cx - 9 + legOffL, baseY - 22, 2, 22, 2)
  g.fillRoundedRect(cx + 2 + legOffR, baseY - 22, 2, 22, 2)
  // Shoes
  g.fillStyle(0x111827)
  g.fillEllipse(cx - 5 + legOffL, baseY - 1, 9, 4)
  g.fillEllipse(cx + 5 + legOffR, baseY - 1, 9, 4)

  // ─── Torso (shirt) ────────────────────────────────────────────────────────
  const torsoY = baseY - 22 - 26
  const torsoW = slump ? 22 : 24
  g.fillStyle(shirt)
  g.fillRoundedRect(cx - torsoW / 2 + torsoTilt, torsoY, torsoW, 28, 6)
  // Shirt highlight (top)
  g.fillStyle(lighten(shirt, 15), 0.5)
  g.fillRoundedRect(cx - torsoW / 2 + torsoTilt, torsoY, torsoW, 4, 4)
  // Shirt shading (right side)
  g.fillStyle(darken(shirt, 25), 0.7)
  g.fillRoundedRect(cx + torsoW / 2 - 4 + torsoTilt, torsoY + 2, 4, 24, 2)
  // Collar / neckline
  g.fillStyle(darken(shirt, 30))
  g.fillRoundedRect(cx - 6 + torsoTilt, torsoY, 12, 4, 2)

  // ─── Arms ────────────────────────────────────────────────────────────────
  const armY = torsoY + 4
  if (armUpper) {
    // Cheer: arms raised up
    g.fillStyle(shirt)
    g.fillRoundedRect(cx - 16, armY - 14, 6, 18, 3)
    g.fillRoundedRect(cx + 10, armY - 14, 6, 18, 3)
    g.fillStyle(skin)
    g.fillCircle(cx - 13, armY - 16, 4)
    g.fillCircle(cx + 13, armY - 16, 4)
  } else {
    // Shoulders → arms
    g.fillStyle(shirt)
    g.fillRoundedRect(cx - 16 + torsoTilt, armY, 7, 20 + armSwingL, 3)
    g.fillRoundedRect(cx + 9 + torsoTilt, armY, 7, 20 + armSwingR, 3)
    // Arm shading
    g.fillStyle(darken(shirt, 20), 0.6)
    g.fillRoundedRect(cx - 16 + torsoTilt, armY, 2, 20 + armSwingL, 1)
    // Hands
    g.fillStyle(skin)
    g.fillCircle(cx - 13 + torsoTilt, armY + 20 + armSwingL, 4)
    g.fillCircle(cx + 13 + torsoTilt, armY + 20 + armSwingR, 4)
    // Hand shading
    g.fillStyle(darken(skin, 8), 0.5)
    g.fillCircle(cx - 13 + torsoTilt, armY + 21 + armSwingL, 3.5)
    g.fillCircle(cx + 13 + torsoTilt, armY + 21 + armSwingR, 3.5)
  }

  // ─── Neck ────────────────────────────────────────────────────────────────
  const neckY = torsoY - 3 + headBob
  g.fillStyle(skin)
  g.fillRoundedRect(cx - 4, neckY, 8, 6, 2)
  g.fillStyle(darken(skin, 15), 0.7)
  g.fillRoundedRect(cx - 4, neckY + 4, 8, 2, 1)

  // ─── Head ────────────────────────────────────────────────────────────────
  const headY = neckY - 10
  // Head (oval)
  g.fillStyle(skin)
  g.fillEllipse(cx, headY, 18, 20)
  // Face shading (right side)
  g.fillStyle(darken(skin, 8), 0.45)
  g.fillEllipse(cx + 4, headY, 10, 18)
  // Highlight (top-left)
  g.fillStyle(lighten(skin, 12), 0.6)
  g.fillEllipse(cx - 4, headY - 3, 6, 8)

  // ─── Hair ────────────────────────────────────────────────────────────────
  // Cap
  g.fillStyle(hair)
  g.fillEllipse(cx, headY - 6, 20, 14)
  // Bangs/fringe
  g.fillEllipse(cx - 4, headY - 4, 10, 8)
  g.fillEllipse(cx + 5, headY - 5, 9, 8)
  // Hair highlight
  g.fillStyle(lighten(hair, 25), 0.5)
  g.fillEllipse(cx - 4, headY - 8, 6, 4)

  // ─── Eyes ────────────────────────────────────────────────────────────────
  if (slump) {
    // Sad eyes — flat lines
    g.fillStyle(0x0b0f1a)
    g.fillRoundedRect(cx - 6, headY - 1, 4, 1.5, 0.5)
    g.fillRoundedRect(cx + 2, headY - 1, 4, 1.5, 0.5)
  } else if (frame === 3) {
    // Happy eyes — curved ^^
    g.fillStyle(0x0b0f1a)
    g.fillRoundedRect(cx - 6, headY - 2, 4, 2, 1)
    g.fillRoundedRect(cx + 2, headY - 2, 4, 2, 1)
  } else {
    // Normal eyes — dark dots with reflection
    g.fillStyle(0x0b0f1a)
    g.fillCircle(cx - 4, headY - 1, 1.6)
    g.fillCircle(cx + 4, headY - 1, 1.6)
    // Catchlight
    g.fillStyle(0xffffff, 0.8)
    g.fillCircle(cx - 4, headY - 2, 0.5)
    g.fillCircle(cx + 4, headY - 2, 0.5)
  }

  // ─── Cheek blush on cheer ────────────────────────────────────────────────
  if (frame === 3) {
    g.fillStyle(0xfca5a5, 0.45)
    g.fillCircle(cx - 7, headY + 3, 2.5)
    g.fillCircle(cx + 7, headY + 3, 2.5)
  }
}

export function generateCharacterSheet(
  scene: Phaser.Scene,
  key: string,
  shirtColor: number,
  variantSeed: number
) {
  if (scene.textures.exists(key)) return
  const g = scene.add.graphics()
  const opts: Omit<CharOptions, 'frame'> = {
    shirt: shirtColor,
    skin: pick(SKIN_TONES, variantSeed),
    hair: pick(HAIR_COLORS, variantSeed + 1),
    pants: pick(PANTS_COLORS, variantSeed + 2),
  }
  for (let f = 0; f < CHAR_FRAMES; f++) {
    drawSimsCharacter(g, f * CHAR_FRAME_W, { ...opts, frame: f })
  }
  g.generateTexture(key, CHAR_FRAME_W * CHAR_FRAMES, CHAR_FRAME_H)
  g.destroy()
}

// ─── Plumbbob ──────────────────────────────────────────────────────────────

export function generatePlumbbob(scene: Phaser.Scene, key: string, color: number) {
  if (scene.textures.exists(key)) return
  const W = 24, H = 32
  const g = scene.add.graphics()
  // Outer glow
  g.fillStyle(color, 0.25)
  g.fillCircle(W / 2, H / 2, 14)
  // Diamond
  const cx = W / 2, cy = H / 2
  // Top half (lighter)
  g.fillStyle(lighten(color, 30))
  g.beginPath()
  g.moveTo(cx, cy - 12)
  g.lineTo(cx + 8, cy)
  g.lineTo(cx, cy)
  g.lineTo(cx - 8, cy)
  g.closePath()
  g.fillPath()
  // Bottom half (darker)
  g.fillStyle(darken(color, 15))
  g.beginPath()
  g.moveTo(cx, cy + 12)
  g.lineTo(cx + 8, cy)
  g.lineTo(cx, cy)
  g.lineTo(cx - 8, cy)
  g.closePath()
  g.fillPath()
  // Center vertical highlight
  g.fillStyle(0xffffff, 0.5)
  g.fillRect(cx - 0.5, cy - 11, 1, 22)
  // Edge stroke
  g.lineStyle(1, darken(color, 30))
  g.strokeTriangle(cx, cy - 12, cx + 8, cy, cx - 8, cy)
  g.strokeTriangle(cx, cy + 12, cx + 8, cy, cx - 8, cy)
  g.generateTexture(key, W, H)
  g.destroy()
}

// ─── Furniture ──────────────────────────────────────────────────────────────

export function generateDeskTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 96, H = 44
  const g = scene.add.graphics()
  // Soft drop shadow
  g.fillStyle(0x000000, 0.25)
  g.fillEllipse(W / 2, H - 2, W - 8, 6)
  // Desktop slab — warm wood
  g.fillStyle(0x8b5a30)
  g.fillRoundedRect(0, 4, W, 14, 4)
  // Wood grain highlights
  g.fillStyle(0xa67847, 0.5)
  g.fillRoundedRect(0, 4, W, 4, 3)
  // Wood grain lines
  g.lineStyle(1, 0x6b4423, 0.4)
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo(0, 6 + i * 3); g.lineTo(W, 6 + i * 3); g.strokePath()
  }
  // Front shading
  g.fillStyle(0x6b4423, 0.6)
  g.fillRoundedRect(0, 14, W, 4, 2)
  // Leg pillars (rounded)
  g.fillStyle(0x3f2410)
  g.fillRoundedRect(6, 18, 6, 22, 2)
  g.fillRoundedRect(W - 12, 18, 6, 22, 2)
  // Leg shading
  g.fillStyle(0x2a1810)
  g.fillRoundedRect(6, 38, 6, 2, 1)
  g.fillRoundedRect(W - 12, 38, 6, 2, 1)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateChairTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 24, H = 42
  const g = scene.add.graphics()
  // Backrest
  g.fillStyle(0x2a3142)
  g.fillRoundedRect(3, 0, 18, 20, 5)
  // Headrest highlight
  g.fillStyle(0x3f4a63, 0.6)
  g.fillRoundedRect(3, 0, 18, 6, 4)
  // Seat
  g.fillStyle(0x374151)
  g.fillRoundedRect(0, 20, 24, 8, 3)
  g.fillStyle(0x4b5563, 0.5)
  g.fillRoundedRect(0, 20, 24, 3, 3)
  // Stem
  g.fillStyle(0x1f2937)
  g.fillRect(10, 28, 4, 8)
  // 5-star base (arc sweeps)
  g.fillStyle(0x111827)
  g.fillEllipse(12, 38, 22, 8)
  g.fillStyle(0x1f2937)
  g.fillEllipse(12, 38, 18, 6)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateMonitorTexture(scene: Phaser.Scene, key: string, screenColor: number) {
  if (scene.textures.exists(key)) return
  const W = 40, H = 32
  const g = scene.add.graphics()
  // Bezel (rounded)
  g.fillStyle(0x111827)
  g.fillRoundedRect(0, 0, W, 24, 3)
  // Screen
  g.fillStyle(screenColor)
  g.fillRoundedRect(3, 3, W - 6, 18, 2)
  // Code-line pattern
  for (let i = 0; i < 6; i++) {
    const lineWidth = 6 + ((i * 11) % 20)
    const color = i % 3 === 0 ? 0x60a5fa : i % 3 === 1 ? 0x86efac : 0xfde68a
    g.fillStyle(color, 0.7)
    g.fillRoundedRect(6, 5 + i * 2.5, lineWidth, 1.5, 0.5)
  }
  // Screen reflection
  g.fillStyle(0xffffff, 0.08)
  g.fillRoundedRect(3, 3, 12, 8, 2)
  // Stand
  g.fillStyle(0x1f2937)
  g.fillRoundedRect(16, 24, 8, 3, 1)
  g.fillStyle(0x111827)
  g.fillEllipse(20, 30, 16, 4)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generatePlantTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 24, H = 36
  const g = scene.add.graphics()
  // Shadow
  g.fillStyle(0x000000, 0.3)
  g.fillEllipse(W / 2, H - 1, 18, 4)
  // Pot
  g.fillStyle(0x7c3f1d)
  g.fillRoundedRect(4, 22, 16, 12, 3)
  g.fillStyle(0x9d5226, 0.6)
  g.fillRoundedRect(4, 22, 16, 3, 2)
  // Pot rim
  g.fillStyle(0x5a2c10)
  g.fillRoundedRect(2, 20, 20, 4, 2)
  // Soil
  g.fillStyle(0x3f2410)
  g.fillEllipse(W / 2, 22, 14, 4)
  // Leaves — multiple ellipses for fullness
  g.fillStyle(0x166534)
  g.fillEllipse(W / 2, 14, 18, 10)
  g.fillStyle(0x15803d)
  g.fillEllipse(W / 2 - 5, 10, 10, 12)
  g.fillEllipse(W / 2 + 5, 10, 10, 12)
  g.fillStyle(0x22c55e)
  g.fillEllipse(W / 2, 6, 12, 8)
  g.fillStyle(0x4ade80, 0.6)
  g.fillEllipse(W / 2 - 3, 5, 6, 4)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateLampTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 18, H = 32
  const g = scene.add.graphics()
  // Base
  g.fillStyle(0x1f2937)
  g.fillEllipse(W / 2, H - 1, 12, 4)
  g.fillStyle(0x374151)
  g.fillEllipse(W / 2, H - 2, 10, 3)
  // Stem
  g.fillStyle(0x4b5563)
  g.fillRect(W / 2 - 1, 10, 2, 20)
  // Shade
  g.fillStyle(0xfcd34d)
  g.beginPath()
  g.moveTo(2, 12); g.lineTo(16, 12); g.lineTo(13, 0); g.lineTo(5, 0); g.closePath()
  g.fillPath()
  g.fillStyle(0xfde68a, 0.6)
  g.beginPath()
  g.moveTo(2, 12); g.lineTo(16, 12); g.lineTo(15, 8); g.lineTo(3, 8); g.closePath()
  g.fillPath()
  // Shade outline
  g.lineStyle(1, 0xb45309, 0.7)
  g.beginPath()
  g.moveTo(2, 12); g.lineTo(16, 12); g.lineTo(13, 0); g.lineTo(5, 0); g.closePath()
  g.strokePath()
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateWhiteboardTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 64, H = 42
  const g = scene.add.graphics()
  // Shadow
  g.fillStyle(0x000000, 0.25)
  g.fillRect(2, H - 4, W - 4, 4)
  // Frame
  g.fillStyle(0x6b4423)
  g.fillRoundedRect(0, 0, W, H, 4)
  g.fillStyle(0x8b5a30, 0.6)
  g.fillRoundedRect(0, 0, W, 4, 3)
  // Board
  g.fillStyle(0xf8fafc)
  g.fillRoundedRect(3, 3, W - 6, H - 8, 2)
  // Marker squiggles
  g.lineStyle(1.5, 0x3b82f6, 0.85)
  g.beginPath()
  g.moveTo(8, 10); g.lineTo(22, 10); g.lineTo(22, 18); g.lineTo(36, 18)
  g.strokePath()
  g.lineStyle(1.5, 0xef4444, 0.85)
  g.beginPath()
  g.moveTo(8, 26); g.lineTo(28, 26); g.lineTo(28, 32)
  g.strokePath()
  g.lineStyle(1.5, 0x10b981, 0.85)
  g.beginPath()
  g.moveTo(40, 10); g.lineTo(56, 10); g.lineTo(48, 20); g.lineTo(56, 32)
  g.strokePath()
  // Marker tray
  g.fillStyle(0x4b3018)
  g.fillRect(3, H - 7, W - 6, 3)
  // Markers
  g.fillStyle(0xef4444); g.fillRect(8, H - 6, 6, 2)
  g.fillStyle(0x3b82f6); g.fillRect(16, H - 6, 6, 2)
  g.fillStyle(0x10b981); g.fillRect(24, H - 6, 6, 2)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateCoolerTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 26, H = 56
  const g = scene.add.graphics()
  // Shadow
  g.fillStyle(0x000000, 0.3)
  g.fillEllipse(W / 2, H - 1, 22, 5)
  // Bottle
  g.fillStyle(0x93c5fd, 0.5)
  g.fillRoundedRect(2, 0, 22, 26, 4)
  g.fillStyle(0x3b82f6, 0.7)
  g.fillRoundedRect(2, 24, 22, 3, 1)
  // Bottle shine
  g.fillStyle(0xffffff, 0.3)
  g.fillRoundedRect(4, 2, 4, 18, 2)
  // Body
  g.fillStyle(0xe5e7eb)
  g.fillRoundedRect(0, 27, W, 28, 3)
  // Body shading
  g.fillStyle(0xcbd5e1, 0.7)
  g.fillRoundedRect(W - 5, 27, 5, 28, 2)
  // Hot tap (red)
  g.fillStyle(0xdc2626)
  g.fillRoundedRect(6, 36, 3, 4, 1)
  // Cold tap (blue)
  g.fillStyle(0x2563eb)
  g.fillRoundedRect(17, 36, 3, 4, 1)
  // Drip pan
  g.fillStyle(0x6b7280)
  g.fillRoundedRect(8, 50, 10, 3, 1)
  g.generateTexture(key, W, H)
  g.destroy()
}

// ─── Walls ──────────────────────────────────────────────────────────────────

export function generateBrickWallTexture(scene: Phaser.Scene, key: string, w = 256, h = 120) {
  if (scene.textures.exists(key)) return
  const g = scene.add.graphics()
  g.fillStyle(0x6b4f3a)
  g.fillRect(0, 0, w, h)
  // Bricks
  for (let row = 0; row < h / 10; row++) {
    const offset = (row % 2) * 14
    for (let col = 0; col < w / 28 + 1; col++) {
      const x = col * 28 + offset
      const y = row * 10
      g.fillStyle(0x8b6740)
      g.fillRoundedRect(x, y, 26, 8, 1)
      // Mortar shading
      g.fillStyle(0x5a3e29, 0.4)
      g.fillRect(x, y + 7, 26, 1)
    }
  }
  g.generateTexture(key, w, h)
  g.destroy()
}

export function generateWindowTexture(scene: Phaser.Scene, key: string, skyColor: number) {
  if (scene.textures.exists(key)) return
  const W = 56, H = 44
  const g = scene.add.graphics()
  // Frame
  g.fillStyle(0x3f2410)
  g.fillRoundedRect(0, 0, W, H, 3)
  g.fillStyle(0x6b4423, 0.7)
  g.fillRoundedRect(0, 0, W, 4, 3)
  // Sky — gradient effect with two fills
  g.fillStyle(skyColor)
  g.fillRoundedRect(4, 4, W - 8, H - 8, 2)
  g.fillStyle(lighten(skyColor, 15), 0.5)
  g.fillRoundedRect(4, 4, W - 8, (H - 8) / 2, 2)
  // Subtle clouds
  g.fillStyle(0xffffff, 0.4)
  g.fillEllipse(16, 14, 12, 4)
  g.fillEllipse(40, 22, 14, 4)
  // Mullions
  g.fillStyle(0x3f2410)
  g.fillRect(W / 2 - 1, 4, 2, H - 8)
  g.fillRect(4, H / 2 - 1, W - 8, 2)
  // Light reflection
  g.fillStyle(0xffffff, 0.15)
  g.fillRoundedRect(6, 6, 12, 14, 2)
  g.generateTexture(key, W, H)
  g.destroy()
}

// ─── Bubble + decor ────────────────────────────────────────────────────────

export function generateBubbleTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 36, H = 28
  const g = scene.add.graphics()
  // Soft shadow
  g.fillStyle(0x000000, 0.25)
  g.fillRoundedRect(2, 22, W - 4, 4, 2)
  // Bubble
  g.fillStyle(0xfafafa)
  g.fillRoundedRect(0, 0, W, 20, 6)
  // Tail
  g.fillTriangle(12, 19, 20, 26, 18, 19)
  g.lineStyle(1.5, 0x0b0f1a, 0.85)
  g.strokeRoundedRect(0, 0, W, 20, 6)
  // Inner highlight
  g.fillStyle(0xffffff, 0.6)
  g.fillRoundedRect(2, 2, W - 4, 4, 4)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateMugTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 14, H = 16
  const g = scene.add.graphics()
  // Shadow
  g.fillStyle(0x000000, 0.3)
  g.fillEllipse(W / 2, H - 1, 10, 2)
  // Body
  g.fillStyle(0xf1f5f9)
  g.fillRoundedRect(2, 4, 8, 10, 1)
  // Handle
  g.lineStyle(2, 0xf1f5f9)
  g.beginPath()
  g.arc(11, 9, 3, -Math.PI / 2, Math.PI / 2)
  g.strokePath()
  // Coffee top
  g.fillStyle(0x6b3410)
  g.fillEllipse(6, 4, 7, 2)
  g.fillStyle(0x8b5a30, 0.5)
  g.fillEllipse(6, 4, 5, 1)
  // Steam
  g.fillStyle(0xffffff, 0.4)
  g.fillCircle(5, 1, 1)
  g.fillCircle(7, 0, 1)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateClockTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 32, H = 32
  const g = scene.add.graphics()
  // Outer ring
  g.fillStyle(0x1f2937)
  g.fillCircle(16, 16, 15)
  // Inner face gradient
  g.fillStyle(0xf8fafc)
  g.fillCircle(16, 16, 13)
  g.fillStyle(0xe2e8f0, 0.5)
  g.fillCircle(16, 16, 12)
  // Tick marks
  g.fillStyle(0x0b0f1a)
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6
    const x = 16 + Math.cos(angle - Math.PI / 2) * 10
    const y = 16 + Math.sin(angle - Math.PI / 2) * 10
    g.fillCircle(x, y, i % 3 === 0 ? 1.2 : 0.7)
  }
  // Hands at 10:10
  g.lineStyle(2.5, 0x0b0f1a)
  g.beginPath(); g.moveTo(16, 16); g.lineTo(10, 10); g.strokePath()
  g.lineStyle(1.8, 0x0b0f1a)
  g.beginPath(); g.moveTo(16, 16); g.lineTo(22, 10); g.strokePath()
  // Center hub
  g.fillStyle(0xef4444)
  g.fillCircle(16, 16, 1.5)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateDividerTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 64, H = 32
  const g = scene.add.graphics()
  // Shadow
  g.fillStyle(0x000000, 0.25)
  g.fillRect(0, H - 4, W, 4)
  // Fabric panel
  g.fillStyle(0x4b5563)
  g.fillRoundedRect(0, 6, W, H - 10, 3)
  // Top trim
  g.fillStyle(0x1f2937)
  g.fillRoundedRect(0, 6, W, 3, 2)
  // Bottom trim
  g.fillRoundedRect(0, H - 7, W, 3, 2)
  // Fabric weave
  g.fillStyle(0x6b7280, 0.35)
  for (let i = 0; i < W; i += 3) {
    g.fillRect(i, 10, 1, H - 18)
  }
  // Subtle vertical lighter stripe
  g.fillStyle(0x9ca3af, 0.15)
  g.fillRect(W / 2, 10, 2, H - 18)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateRugTexture(scene: Phaser.Scene, key: string, baseColor: number, accentColor: number) {
  if (scene.textures.exists(key)) return
  const W = 128, H = 80
  const g = scene.add.graphics()
  // Base rug
  g.fillStyle(baseColor)
  g.fillRoundedRect(0, 0, W, H, 8)
  // Inner border
  g.lineStyle(3, accentColor, 0.8)
  g.strokeRoundedRect(8, 8, W - 16, H - 16, 6)
  // Fringe
  g.lineStyle(1, darken(baseColor, 15))
  for (let i = 0; i < W; i += 4) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 2, 4); g.strokePath()
    g.beginPath(); g.moveTo(i, H); g.lineTo(i + 2, H - 4); g.strokePath()
  }
  // Center motif
  g.fillStyle(accentColor, 0.4)
  g.fillCircle(W / 2, H / 2, 14)
  g.fillStyle(baseColor)
  g.fillCircle(W / 2, H / 2, 10)
  g.fillStyle(accentColor, 0.7)
  g.fillCircle(W / 2, H / 2, 5)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generatePictureFrameTexture(scene: Phaser.Scene, key: string, accent: number) {
  if (scene.textures.exists(key)) return
  const W = 36, H = 28
  const g = scene.add.graphics()
  // Frame
  g.fillStyle(0x3f2410)
  g.fillRoundedRect(0, 0, W, H, 2)
  g.fillStyle(0x6b4423, 0.6)
  g.fillRoundedRect(0, 0, W, 3, 2)
  // Picture — abstract art
  g.fillStyle(accent)
  g.fillRoundedRect(3, 3, W - 6, H - 6, 1)
  g.fillStyle(lighten(accent, 30), 0.5)
  g.fillTriangle(3, H - 3, 12, 6, 22, H - 3)
  g.fillStyle(0xffffff, 0.3)
  g.fillCircle(W - 9, 9, 4)
  g.generateTexture(key, W, H)
  g.destroy()
}

export function generateBookshelfTexture(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return
  const W = 48, H = 64
  const g = scene.add.graphics()
  // Shadow
  g.fillStyle(0x000000, 0.3)
  g.fillRect(2, H - 3, W - 4, 3)
  // Frame
  g.fillStyle(0x4a2c0e)
  g.fillRoundedRect(0, 0, W, H, 2)
  g.fillStyle(0x6b3e10, 0.6)
  g.fillRoundedRect(0, 0, W, 3, 2)
  // Shelves
  g.fillStyle(0x6b3e10)
  g.fillRect(2, 18, W - 4, 2)
  g.fillRect(2, 40, W - 4, 2)
  // Books — rows
  const bookColors = [0xdc2626, 0x2563eb, 0x16a34a, 0xeab308, 0xea580c, 0x7c3aed, 0xdb2777]
  function row(y: number) {
    let x = 3
    let i = Math.floor(y * 13) % bookColors.length
    while (x < W - 5) {
      const w = 3 + (i % 4)
      const h = 13 + (i % 3)
      g.fillStyle(bookColors[(i + Math.floor(y)) % bookColors.length])
      g.fillRect(x, y - h, w, h)
      g.fillStyle(0xffffff, 0.1)
      g.fillRect(x, y - h, 1, h)
      x += w + 1
      i++
    }
  }
  row(18); row(40); row(62)
  g.generateTexture(key, W, H)
  g.destroy()
}
