import Phaser from 'phaser'
import { PERSONAS } from '../../../../shared/personas'
import type { Project } from '../../../../shared/types'
import {
  generateCharacterSheet, generatePlumbbob, generateDeskTexture, generateChairTexture,
  generateMonitorTexture, generatePlantTexture, generateLampTexture,
  generateWhiteboardTexture, generateCoolerTexture, generateBrickWallTexture,
  generateWindowTexture, generateBubbleTexture,
  generateMugTexture, generateClockTexture, generateDividerTexture,
  generateRugTexture, generatePictureFrameTexture, generateBookshelfTexture,
} from '../sprites/procedural'

const TILE_W = 64
const TILE_H = 32
const FLOOR_COLS = 18
const FLOOR_ROWS = 14

const ZONE_EXEC_ROWS = [0, 4]
const ZONE_DEV_ROWS  = [4, 10]
const ZONE_LOUNGE_ROWS = [10, 14]

type StatusKey = 'active' | 'paused' | 'archived' | 'failing'
type EventKey = 'task.queued' | 'task.started' | 'task.completed' | 'task.failed' | 'github.push'

interface OfficeEvent {
  projectId: string
  event: EventKey
  ts: number
}

interface StatusVisual {
  color: number
  shape: 'circle' | 'triangle' | 'square' | 'diamond'
  label: string
}

const STATUS_VISUALS: Record<StatusKey, StatusVisual> = {
  active:   { color: 0x10b981, shape: 'circle',   label: 'LIVE' },
  paused:   { color: 0xf59e0b, shape: 'triangle', label: 'HOLD' },
  archived: { color: 0x64748b, shape: 'square',   label: 'OFF' },
  failing:  { color: 0xef4444, shape: 'diamond',  label: 'FAIL' },
}

interface DeskWorkstation {
  projectId: string
  container: Phaser.GameObjects.Container
  character: Phaser.GameObjects.Sprite
  monitorGlow: Phaser.GameObjects.Rectangle
  plumbbob: Phaser.GameObjects.Image
  home: { x: number; y: number }
  walkingUntil: number
  charKey: string
  isWalking: boolean
}

function isoToScreen(col: number, row: number) {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  }
}

interface TimeOfDay {
  label: 'morning' | 'day' | 'dusk' | 'night'
  skyColor: number
  ambientBg: number
  ambientOverlay: number
  ambientOverlayAlpha: number
  lampOpacity: number
}

function timeOfDay(): TimeOfDay {
  const h = new Date().getHours()
  if (h >= 6 && h < 10)  return { label: 'morning', skyColor: 0xffd9a0, ambientBg: 0x3a2f1f, ambientOverlay: 0xffd9a0, ambientOverlayAlpha: 0.08, lampOpacity: 0.20 }
  if (h >= 10 && h < 17) return { label: 'day',     skyColor: 0x9bd1ff, ambientBg: 0x2a3142, ambientOverlay: 0x9bd1ff, ambientOverlayAlpha: 0.04, lampOpacity: 0.10 }
  if (h >= 17 && h < 20) return { label: 'dusk',    skyColor: 0xffb070, ambientBg: 0x3a2118, ambientOverlay: 0xffb070, ambientOverlayAlpha: 0.10, lampOpacity: 0.45 }
  return { label: 'night', skyColor: 0x1e293b, ambientBg: 0x0a0e1a, ambientOverlay: 0x000814, ambientOverlayAlpha: 0.32, lampOpacity: 0.85 }
}

function resolveStatus(project: Project): StatusKey {
  if (project.status === 'archived') return 'archived'
  if (project.status === 'paused') return 'paused'
  return 'active'
}

export class OfficeScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Container
  private floorLayer!: Phaser.GameObjects.Container
  private wallLayer!: Phaser.GameObjects.Container
  private propLayer!: Phaser.GameObjects.Container
  private dynamicLayer!: Phaser.GameObjects.Container
  private lightLayer!: Phaser.GameObjects.Container
  private dustLayer!: Phaser.GameObjects.Container
  private uiLayer!: Phaser.GameObjects.Container
  private ambientOverlay!: Phaser.GameObjects.Rectangle

  private workstations = new Map<string, DeskWorkstation>()
  private jarvis!: Phaser.GameObjects.Container
  private coolerPos = { x: 0, y: 0 }

  private prefersReducedMotion = false
  private isDragging = false
  private dragStart = { x: 0, y: 0, cam: { x: 0, y: 0 } }

  private audioCtx: AudioContext | null = null
  private audioGain: GainNode | null = null
  private audioEnabled = false

  constructor() {
    super({ key: 'OfficeScene' })
  }

  create() {
    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

    const tod = timeOfDay()

    // Audio setup deferred until user gesture
    this.audioEnabled = this.registry.get('audioEnabled') === true

    // Texture preload
    PERSONAS.forEach((p, i) => {
      const shirt = Number(`0x${p.paletteHex.slice(1)}`)
      generateCharacterSheet(this, `char_${p.id}`, shirt, i)
      generatePlumbbob(this, `plumb_${p.id}`, shirt)
    })
    generateDeskTexture(this, 'desk')
    generateChairTexture(this, 'chair')
    generateMonitorTexture(this, 'monitor', 0x0b1a2f)
    generatePlantTexture(this, 'plant')
    generateLampTexture(this, 'lamp')
    generateWhiteboardTexture(this, 'whiteboard')
    generateCoolerTexture(this, 'cooler')
    generateBrickWallTexture(this, 'wall')
    generateWindowTexture(this, 'window', tod.skyColor)
    generateBubbleTexture(this, 'bubble')
    generateMugTexture(this, 'mug')
    generateClockTexture(this, 'clock')
    generateDividerTexture(this, 'divider')
    generateRugTexture(this, 'rug_exec', 0x6b2c91, 0xfbbf24)
    generateRugTexture(this, 'rug_lounge', 0x065f46, 0xfde68a)
    generatePictureFrameTexture(this, 'pic_1', 0x3b82f6)
    generatePictureFrameTexture(this, 'pic_2', 0xec4899)
    generatePictureFrameTexture(this, 'pic_3', 0x10b981)
    generateBookshelfTexture(this, 'bookshelf')

    // Animations
    PERSONAS.forEach(p => {
      const k = `char_${p.id}`
      if (this.anims.exists(`${k}_idle`)) return
      this.anims.create({
        key: `${k}_idle`,
        frames: this.anims.generateFrameNumbers(k, { frames: [0] }),
        frameRate: 1, repeat: -1,
      })
      this.anims.create({
        key: `${k}_type`,
        frames: this.anims.generateFrameNumbers(k, { frames: [1, 2] }),
        frameRate: 4, repeat: -1,
      })
      this.anims.create({
        key: `${k}_cheer`,
        frames: this.anims.generateFrameNumbers(k, { frames: [3] }),
        frameRate: 1, repeat: 0,
      })
      this.anims.create({
        key: `${k}_slump`,
        frames: this.anims.generateFrameNumbers(k, { frames: [4] }),
        frameRate: 1, repeat: 0,
      })
      this.anims.create({
        key: `${k}_walk`,
        frames: this.anims.generateFrameNumbers(k, { frames: [5, 6] }),
        frameRate: 6, repeat: -1,
      })
    })

    this.cameras.main.setBackgroundColor(tod.ambientBg)

    this.world = this.add.container(0, 0)
    this.floorLayer = this.add.container(0, 0); this.world.add(this.floorLayer)
    this.wallLayer = this.add.container(0, 0); this.world.add(this.wallLayer)
    this.propLayer = this.add.container(0, 0); this.world.add(this.propLayer)
    this.dynamicLayer = this.add.container(0, 0); this.world.add(this.dynamicLayer)
    this.lightLayer = this.add.container(0, 0); this.world.add(this.lightLayer)
    this.dustLayer = this.add.container(0, 0); this.world.add(this.dustLayer)
    this.uiLayer = this.add.container(0, 0)

    this.drawRooms()
    this.drawRugs()
    this.drawWalls(tod)
    this.drawWallDecor()
    this.drawStaticProps()
    this.drawDesks()
    this.drawJarvis()
    this.drawLighting(tod)
    this.drawAmbientOverlay(tod)
    this.drawDust(tod)
    this.centerWorld()
    this.setupCameraControls()
    this.startWalkScheduler()
    this.startIdleCameraDrift()
    this.startTimeOfDayWatcher()

    this.registry.events.on('changedata', (_p: unknown, key: string, value: unknown) => {
      if (key === 'projects') this.redraw()
      if (key === 'lastEvent') this.handleEvent(value as OfficeEvent | null)
      if (key === 'audioEnabled') this.setAudioEnabled(value as boolean)
    })

    this.scale.on('resize', () => this.centerWorld())

    // Wire first-gesture sound init
    this.input.once('pointerdown', () => this.initAudio())
  }

  private centerWorld() {
    const cx = this.scale.width / 2
    const cy = this.scale.height / 2 - (FLOOR_ROWS * TILE_H) / 2
    this.world.setPosition(cx, cy)
  }

  private redraw() {
    this.workstations.clear()
    this.dynamicLayer.removeAll(true)
    this.drawDesks()
    this.drawJarvis()
  }

  // ─── Floor rooms ────────────────────────────────────────────────────────────

  private drawRooms() {
    const g = this.add.graphics()
    this.floorLayer.add(g)
    for (let row = 0; row < FLOOR_ROWS; row++) {
      for (let col = 0; col < FLOOR_COLS; col++) {
        const { x, y } = isoToScreen(col, row)
        const zone = this.rowZone(row)
        const color = this.tileColor(zone, col, row)
        g.fillStyle(color)
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + TILE_W / 2, y + TILE_H / 2)
        g.lineTo(x, y + TILE_H)
        g.lineTo(x - TILE_W / 2, y + TILE_H / 2)
        g.closePath()
        g.fillPath()
        g.lineStyle(1, 0x000000, 0.18)
        g.strokePath()
      }
    }
    this.addZoneLabel('EXECUTIVE SUITE', (ZONE_EXEC_ROWS[0] + ZONE_EXEC_ROWS[1]) / 2)
    this.addZoneLabel('DEV PIT',          (ZONE_DEV_ROWS[0] + ZONE_DEV_ROWS[1]) / 2)
    this.addZoneLabel('LOUNGE',           (ZONE_LOUNGE_ROWS[0] + ZONE_LOUNGE_ROWS[1]) / 2)
  }

  private drawRugs() {
    // Exec rug under exec desks
    const ec = isoToScreen(6, 2)
    const ru = this.add.image(ec.x, ec.y + 8, 'rug_exec').setOrigin(0.5, 0.5).setAlpha(0.85)
    ru.setRotation(Math.PI / 8)
    this.floorLayer.add(ru)
    // Lounge rug
    const lc = isoToScreen(10, 12)
    const rl = this.add.image(lc.x, lc.y + 4, 'rug_lounge').setOrigin(0.5, 0.5).setAlpha(0.85)
    rl.setRotation(-Math.PI / 8)
    this.floorLayer.add(rl)
  }

  private rowZone(row: number): 'exec' | 'dev' | 'lounge' {
    if (row < ZONE_EXEC_ROWS[1]) return 'exec'
    if (row < ZONE_DEV_ROWS[1]) return 'dev'
    return 'lounge'
  }

  private tileColor(zone: 'exec' | 'dev' | 'lounge', col: number, row: number) {
    const alt = (col + row) % 2 === 0
    switch (zone) {
      // Warmer Sims palette
      case 'exec':   return alt ? 0x4a2f5f : 0x402952 // warm purple carpet
      case 'dev':    return alt ? 0x8b5a30 : 0x7a4f29 // warm oak planks
      case 'lounge': return alt ? 0x2f6650 : 0x285847 // warm green carpet
    }
  }

  private addZoneLabel(text: string, row: number) {
    const { x, y } = isoToScreen(-1, row)
    const t = this.add.text(x - 100, y - 4, text, {
      fontSize: '10px', color: '#fde68a', fontStyle: 'bold',
      backgroundColor: '#0b0f1aB0', padding: { x: 5, y: 2 },
    })
    t.setAlpha(0.6)
    this.floorLayer.add(t)
  }

  // ─── Walls ──────────────────────────────────────────────────────────────────

  private drawWalls(tod: TimeOfDay) {
    const topLeft = isoToScreen(0, 0)
    const topRight = isoToScreen(FLOOR_COLS - 1, 0)
    const wallHeight = 108

    const wallLeft = this.add.tileSprite(
      (topLeft.x + topRight.x) / 2,
      topLeft.y - wallHeight / 2,
      Math.abs(topRight.x - topLeft.x) + TILE_W,
      wallHeight,
      'wall'
    )
    wallLeft.setOrigin(0.5, 0.5)
    this.wallLayer.add(wallLeft)

    // Wall top trim
    const trim = this.add.rectangle(
      (topLeft.x + topRight.x) / 2,
      topLeft.y - wallHeight - 2,
      Math.abs(topRight.x - topLeft.x) + TILE_W,
      4,
      0x3f2410,
    )
    this.wallLayer.add(trim)

    // Windows
    for (let col = 1; col < FLOOR_COLS - 1; col += 3) {
      const { x } = isoToScreen(col, 0)
      const win = this.add.image(x, topLeft.y - wallHeight + 22, 'window').setOrigin(0.5, 0)
      this.wallLayer.add(win)
      if (tod.label !== 'night') {
        const beam = this.add.graphics()
        beam.fillStyle(tod.skyColor, 0.1)
        beam.beginPath()
        beam.moveTo(x - 18, topLeft.y - 6)
        beam.lineTo(x + 18, topLeft.y - 6)
        beam.lineTo(x + 70, topLeft.y + 100)
        beam.lineTo(x - 34, topLeft.y + 100)
        beam.closePath()
        beam.fillPath()
        this.wallLayer.add(beam)
      }
    }

    const sideTop = isoToScreen(FLOOR_COLS - 1, 0)
    const sideBottom = isoToScreen(FLOOR_COLS - 1, FLOOR_ROWS - 1)
    const sideWall = this.add.tileSprite(
      (sideTop.x + sideBottom.x) / 2 + TILE_W / 2,
      (sideTop.y + sideBottom.y) / 2,
      Math.abs(sideBottom.y - sideTop.y) + TILE_H,
      wallHeight * 0.6,
      'wall'
    )
    sideWall.setRotation(Math.atan2(sideBottom.y - sideTop.y, sideBottom.x - sideTop.x))
    sideWall.setAlpha(0.65)
    this.wallLayer.add(sideWall)
  }

  private drawWallDecor() {
    // Picture frames on back wall (between windows)
    const picKeys = ['pic_1', 'pic_2', 'pic_3']
    let i = 0
    for (let col = 2; col < FLOOR_COLS - 1; col += 6) {
      const { x, y } = isoToScreen(col, 0)
      const pic = this.add.image(x + 10, y - 78, picKeys[i % picKeys.length]).setOrigin(0.5, 0)
      this.wallLayer.add(pic)
      i++
    }
  }

  // ─── Static props ──────────────────────────────────────────────────────────

  private drawStaticProps() {
    // Whiteboards
    {
      const { x, y } = isoToScreen(3, 0)
      this.propLayer.add(this.add.image(x, y - 50, 'whiteboard').setOrigin(0.5, 1))
    }
    {
      const { x, y } = isoToScreen(6, 0)
      this.propLayer.add(this.add.image(x, y - 64, 'clock').setOrigin(0.5, 1))
    }
    {
      const { x, y } = isoToScreen(9, 0)
      this.propLayer.add(this.add.image(x, y - 50, 'whiteboard').setOrigin(0.5, 1))
    }
    // Bookshelf in exec zone corner
    {
      const { x, y } = isoToScreen(0, 1)
      const bs = this.add.image(x, y, 'bookshelf').setOrigin(0.5, 1)
      bs.setDepth(y)
      this.propLayer.add(bs)
    }
    // Cubicle dividers in dev pit
    for (const row of [5, 8]) {
      for (const col of [4, 7, 10, 13]) {
        const { x, y } = isoToScreen(col - 0.5, row)
        const d = this.add.image(x, y, 'divider').setOrigin(0.5, 0.7).setAlpha(0.85)
        d.setDepth(y - 1)
        this.propLayer.add(d)
      }
    }
    // Water cooler (track position for walking)
    {
      const { x, y } = isoToScreen(FLOOR_COLS - 2, FLOOR_ROWS - 2)
      this.coolerPos = { x, y }
      const cooler = this.add.image(x, y, 'cooler').setOrigin(0.5, 1)
      cooler.setDepth(y)
      this.propLayer.add(cooler)
    }
    // Plants
    const plantSpots = [
      [1, FLOOR_ROWS - 1], [3, FLOOR_ROWS - 2], [FLOOR_COLS - 3, FLOOR_ROWS - 1],
      [6, FLOOR_ROWS - 3], [FLOOR_COLS - 5, FLOOR_ROWS - 2],
      [0, 3], [FLOOR_COLS - 2, 1],
    ]
    plantSpots.forEach(([c, r]) => {
      const { x, y } = isoToScreen(c, r)
      const p = this.add.image(x, y, 'plant').setOrigin(0.5, 1)
      p.setDepth(y)
      this.propLayer.add(p)
    })
  }

  // ─── Desks ─────────────────────────────────────────────────────────────────

  private deskPosition(i: number): { col: number; row: number } {
    const execSlots = [{col:2,row:2},{col:5,row:2},{col:8,row:2},{col:11,row:2}]
    const devSlots = [
      {col:2,row:5},{col:5,row:5},{col:8,row:5},{col:11,row:5},{col:14,row:5},
      {col:2,row:8},{col:5,row:8},{col:8,row:8},{col:11,row:8},{col:14,row:8},
    ]
    if (i < execSlots.length) return execSlots[i]
    if (i - execSlots.length < devSlots.length) return devSlots[i - execSlots.length]
    const idx = i - execSlots.length - devSlots.length
    return { col: 4 + (idx % 4) * 3, row: 11 }
  }

  private drawDesks() {
    const projects = (this.registry.get('projects') as Project[] | undefined) ?? []
    const onDeskClick = this.registry.get('onDeskClick') as ((id: string) => void) | undefined

    projects.forEach((project, i) => {
      const pos = this.deskPosition(i)
      const { x, y } = isoToScreen(pos.col, pos.row)
      const persona = PERSONAS[i % PERSONAS.length]
      const status = resolveStatus(project)
      const statusVis = STATUS_VISUALS[status]

      const container = this.add.container(x, y)
      container.setDepth(y)

      const shadow = this.add.ellipse(0, 14, 78, 18, 0x000000, 0.32)
      shadow.setBlendMode(Phaser.BlendModes.MULTIPLY)

      const chair = this.add.image(-6, 4, 'chair').setOrigin(0.5, 1)
      const desk = this.add.image(0, 12, 'desk').setOrigin(0.5, 1)
      const monitor = this.add.image(0, -6, 'monitor').setOrigin(0.5, 1)
      const monitorGlow = this.add.rectangle(0, -22, 34, 18, 0x60a5fa, 0.35)
      monitorGlow.setBlendMode(Phaser.BlendModes.ADD)

      const charKey = `char_${persona.id}`
      const character = this.add.sprite(0, -8, charKey, 0)
      character.setOrigin(0.5, 1)
      character.setScale(0.85)
      character.play(`${charKey}_type`)

      // Plumbbob above character — Sims signature
      const plumbbob = this.add.image(0, -88, `plumb_${persona.id}`)
      plumbbob.setBlendMode(Phaser.BlendModes.ADD)

      const nameBg = this.add.rectangle(0, -106, 100, 16, 0x0b0f1a, 0.92).setStrokeStyle(2, statusVis.color)
      const nameTag = this.add.text(0, -106, `${persona.displayName} · ${project.name}`, {
        fontSize: '10px', color: '#fde68a', fontStyle: 'bold',
      }).setOrigin(0.5)
      nameBg.setSize(nameTag.width + 14, 18)

      // Status glyph
      const glyphX = 44
      const glyphY = -100
      let glyph: Phaser.GameObjects.Shape
      switch (statusVis.shape) {
        case 'circle':   glyph = this.add.circle(glyphX, glyphY, 5, statusVis.color); break
        case 'triangle': glyph = this.add.triangle(glyphX, glyphY, 0, 5, 5, -5, -5, -5, statusVis.color); break
        case 'square':   glyph = this.add.rectangle(glyphX, glyphY, 8, 8, statusVis.color); break
        case 'diamond':  glyph = this.add.polygon(glyphX, glyphY, [0, -6, 6, 0, 0, 6, -6, 0], statusVis.color); break
      }
      glyph.setStrokeStyle(1, 0x0b0f1a)
      const glyphLabel = this.add.text(glyphX + 8, glyphY, statusVis.label, {
        fontSize: '8px', color: '#fef3c7', fontStyle: 'bold',
        backgroundColor: '#0b0f1aDD', padding: { x: 3, y: 1 },
      }).setOrigin(0, 0.5)

      container.add([shadow, chair, desk, monitor, monitorGlow, character, plumbbob, nameBg, nameTag, glyph, glyphLabel])
      container.setSize(96, 130)
      container.setInteractive(new Phaser.Geom.Rectangle(-48, -120, 96, 132), Phaser.Geom.Rectangle.Contains)

      container.on('pointerover', () => {
        container.setScale(1.04)
        nameTag.setColor('#fbbf24')
      })
      container.on('pointerout', () => {
        container.setScale(1.0)
        nameTag.setColor('#fde68a')
      })
      container.on('pointerdown', () => {
        if (onDeskClick) onDeskClick(project.id)
      })

      if (!this.prefersReducedMotion) {
        // Monitor flicker
        this.tweens.add({
          targets: monitorGlow, alpha: { from: 0.25, to: 0.55 },
          duration: 2200 + (i * 137) % 800, yoyo: true, repeat: -1,
        })
        // Plumbbob rotation
        this.tweens.add({
          targets: plumbbob, angle: 360,
          duration: 4500, repeat: -1,
        })
        // Plumbbob float
        this.tweens.add({
          targets: plumbbob, y: { from: -88, to: -94 },
          duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
        // Character breathing
        this.tweens.add({
          targets: character, y: { from: -8, to: -9 },
          duration: 1600 + (i * 80) % 600,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }

      this.dynamicLayer.add(container)
      this.workstations.set(project.id, {
        projectId: project.id, container, character, monitorGlow, plumbbob,
        home: { x, y }, walkingUntil: 0, charKey, isWalking: false,
      })

      // Lamp on desk
      const lampSprite = this.add.image(x - 32, y - 4, 'lamp').setOrigin(0.5, 1)
      lampSprite.setDepth(y - 1)
      this.dynamicLayer.add(lampSprite)

      // Coffee mug if idle > 4h
      const lastActive = project.lastActiveAt ? new Date(project.lastActiveAt).getTime() : 0
      if ((Date.now() - lastActive) / (3600 * 1000) > 4) {
        const mug = this.add.image(x + 22, y - 8, 'mug').setOrigin(0.5, 1)
        mug.setDepth(y + 1)
        this.dynamicLayer.add(mug)
      }

      // Random idle break (pause typing)
      if (!this.prefersReducedMotion) {
        const scheduleIdleBreak = () => {
          const delay = 9000 + Math.random() * 12000
          this.time.delayedCall(delay, () => {
            if (this.workstations.get(project.id)?.isWalking) { scheduleIdleBreak(); return }
            character.play(`${charKey}_idle`)
            this.time.delayedCall(1200 + Math.random() * 1800, () => {
              if (!this.workstations.get(project.id)?.isWalking) {
                character.play(`${charKey}_type`)
              }
              scheduleIdleBreak()
            })
          })
        }
        scheduleIdleBreak()
      }
    })

    if (projects.length === 0) {
      const { x, y } = isoToScreen(FLOOR_COLS / 2, FLOOR_ROWS / 2)
      const t = this.add.text(x, y, 'No projects yet.\nOpen Grid view to add one.', {
        fontSize: '14px', color: '#fde68a', align: 'center',
        backgroundColor: '#0b0f1aDD', padding: { x: 12, y: 8 },
      }).setOrigin(0.5)
      this.dynamicLayer.add(t)
    }
  }

  // ─── Walking system ────────────────────────────────────────────────────────

  private startWalkScheduler() {
    if (this.prefersReducedMotion) return
    this.time.addEvent({
      delay: 18000, loop: true,
      callback: () => this.maybeWalkSomeone(),
    })
    // Initial delayed first walk
    this.time.delayedCall(8000, () => this.maybeWalkSomeone())
  }

  private maybeWalkSomeone() {
    const candidates = Array.from(this.workstations.values()).filter(w => !w.isWalking)
    if (candidates.length === 0) return
    if (Math.random() > 0.5) return
    const w = candidates[Math.floor(Math.random() * candidates.length)]
    this.walkToCoolerAndBack(w)
  }

  private walkToCoolerAndBack(w: DeskWorkstation) {
    w.isWalking = true
    w.character.play(`${w.charKey}_walk`)
    const goal = { x: this.coolerPos.x - 24, y: this.coolerPos.y - 10 }
    // Walk to cooler
    this.tweens.add({
      targets: w.container, x: goal.x, y: goal.y,
      duration: 3200, ease: 'Linear',
      onUpdate: () => { w.container.setDepth(w.container.y) },
      onComplete: () => {
        // Pause at cooler
        w.character.play(`${w.charKey}_idle`)
        this.time.delayedCall(1800, () => {
          w.character.play(`${w.charKey}_walk`)
          // Walk back home
          this.tweens.add({
            targets: w.container, x: w.home.x, y: w.home.y,
            duration: 3200, ease: 'Linear',
            onUpdate: () => { w.container.setDepth(w.container.y) },
            onComplete: () => {
              w.isWalking = false
              w.character.play(`${w.charKey}_type`)
            },
          })
        })
      },
    })
  }

  // ─── Jarvis NPC ────────────────────────────────────────────────────────────

  private drawJarvis() {
    const { x, y } = isoToScreen(FLOOR_COLS - 1, FLOOR_ROWS - 1)

    // Reception desk near Jarvis
    const recX = x - 70
    const recY = y - 4
    const recDesk = this.add.image(recX, recY, 'desk').setOrigin(0.5, 1)
    recDesk.setDepth(recY)
    this.dynamicLayer.add(recDesk)
    const recPlant = this.add.image(recX - 36, recY, 'plant').setOrigin(0.5, 1)
    recPlant.setDepth(recY)
    this.dynamicLayer.add(recPlant)

    this.jarvis = this.add.container(x - 48, y - 20)
    this.jarvis.setDepth(y + 2000)
    const halo = this.add.circle(0, -8, 28, 0xfbbf24, 0.22)
    halo.setBlendMode(Phaser.BlendModes.ADD)
    const haloOuter = this.add.circle(0, -8, 40, 0xfbbf24, 0.08)
    haloOuter.setBlendMode(Phaser.BlendModes.ADD)
    const body = this.add.ellipse(0, -8, 22, 32, 0xfbbf24, 0.95)
    const innerLight = this.add.ellipse(0, -14, 10, 10, 0xfffbeb)
    const tag = this.add.rectangle(0, -42, 50, 18, 0x0b0f1a, 0.95).setStrokeStyle(1, 0xfbbf24)
    const tagText = this.add.text(0, -42, 'JARVIS', {
      fontSize: '10px', color: '#fbbf24', fontStyle: 'bold',
    }).setOrigin(0.5)
    this.jarvis.add([haloOuter, halo, body, innerLight, tag, tagText])
    this.dynamicLayer.add(this.jarvis)

    if (!this.prefersReducedMotion) {
      this.tweens.add({
        targets: [halo, haloOuter], scale: { from: 1, to: 1.4 },
        alpha: { from: 0.22, to: 0.06 },
        duration: 2000, yoyo: true, repeat: -1,
      })
      this.tweens.add({
        targets: this.jarvis, y: this.jarvis.y - 4,
        duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }
  }

  // ─── Lighting ──────────────────────────────────────────────────────────────

  private drawLighting(tod: TimeOfDay) {
    if (tod.lampOpacity < 0.05) return
    this.workstations.forEach(({ home }) => {
      const halo = this.add.circle(home.x - 32, home.y - 18, 36, 0xfbbf24, tod.lampOpacity * 0.55)
      halo.setBlendMode(Phaser.BlendModes.ADD)
      this.lightLayer.add(halo)
      if (!this.prefersReducedMotion) {
        this.tweens.add({
          targets: halo, alpha: { from: tod.lampOpacity * 0.45, to: tod.lampOpacity * 0.65 },
          duration: 2400, yoyo: true, repeat: -1,
        })
      }
    })
  }

  private drawAmbientOverlay(tod: TimeOfDay) {
    this.ambientOverlay = this.add.rectangle(0, 0, 4000, 4000, tod.ambientOverlay, tod.ambientOverlayAlpha)
    this.ambientOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY)
    this.ambientOverlay.setOrigin(0)
    this.ambientOverlay.setPosition(-2000, -2000)
    this.lightLayer.add(this.ambientOverlay)
  }

  // ─── Dust ──────────────────────────────────────────────────────────────────

  private drawDust(tod: TimeOfDay) {
    if (this.prefersReducedMotion) return
    const count = tod.label === 'night' ? 8 : 22
    for (let i = 0; i < count; i++) this.spawnDust(tod.skyColor)
    this.time.addEvent({
      delay: 600, loop: true,
      callback: () => this.spawnDust(tod.skyColor),
    })
  }

  private spawnDust(skyColor: number) {
    const { x: ox } = isoToScreen(Math.floor(Math.random() * FLOOR_COLS), 0)
    const startY = -50
    const dust = this.add.circle(ox + (Math.random() - 0.5) * 80, startY, 1.5, skyColor, 0.5)
    dust.setBlendMode(Phaser.BlendModes.ADD)
    this.dustLayer.add(dust)
    this.tweens.add({
      targets: dust,
      x: dust.x + (Math.random() - 0.5) * 120,
      y: startY + 360 + Math.random() * 80,
      alpha: 0,
      duration: 9000 + Math.random() * 5000,
      onComplete: () => dust.destroy(),
    })
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  private handleEvent(evt: OfficeEvent | null) {
    if (!evt) return
    const ws = this.workstations.get(evt.projectId)
    if (!ws) return
    const { character, container, charKey } = ws
    const worldX = container.x
    const worldY = container.y

    if (this.audioEnabled) this.playEventSound(evt.event)

    switch (evt.event) {
      case 'task.queued':
        this.showBubble(worldX, worldY - 110, '⋯')
        break
      case 'task.started':
        if (!ws.isWalking) character.play(`${charKey}_type`)
        this.showBubble(worldX, worldY - 110, '⚙')
        break
      case 'task.completed':
        if (!ws.isWalking) character.play(`${charKey}_cheer`)
        this.emitParticles(worldX, worldY - 80, 0x10b981)
        this.showBubble(worldX, worldY - 110, '✓')
        this.time.delayedCall(2200, () => {
          if (!ws.isWalking) character.play(`${charKey}_type`)
        })
        break
      case 'task.failed':
        if (!ws.isWalking) character.play(`${charKey}_slump`)
        this.emitParticles(worldX, worldY - 80, 0xef4444)
        this.showBubble(worldX, worldY - 110, '!')
        this.time.delayedCall(3000, () => {
          if (!ws.isWalking) character.play(`${charKey}_type`)
        })
        break
      case 'github.push':
        this.emitParticles(worldX, worldY - 100, 0x60a5fa)
        this.showBubble(worldX, worldY - 110, 'git')
        break
    }
  }

  private showBubble(x: number, y: number, glyph: string) {
    const bubble = this.add.image(x + 22, y, 'bubble').setOrigin(0.5)
    bubble.setDepth(y + 5000)
    const t = this.add.text(x + 22, y - 4, glyph, {
      fontSize: '12px', color: '#0b0f1a', fontStyle: 'bold',
    }).setOrigin(0.5)
    t.setDepth(y + 5001)
    this.uiLayer.add([bubble, t])
    this.tweens.add({
      targets: [bubble, t], y: `-=10`, alpha: { from: 1, to: 0 },
      duration: 1800, ease: 'Sine.easeOut',
      onComplete: () => { bubble.destroy(); t.destroy() },
    })
  }

  private emitParticles(x: number, y: number, color: number) {
    for (let i = 0; i < 12; i++) {
      const p = this.add.circle(x, y, 3, color)
      p.setBlendMode(Phaser.BlendModes.ADD)
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.4
      const dist = 26 + Math.random() * 16
      this.uiLayer.add(p)
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 8,
        alpha: 0, scale: { from: 1, to: 0.3 },
        duration: 900,
        onComplete: () => p.destroy(),
      })
    }
  }

  // ─── Camera ────────────────────────────────────────────────────────────────

  private setupCameraControls() {
    const cam = this.cameras.main
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true
      this.dragStart = { x: p.x, y: p.y, cam: { x: cam.scrollX, y: cam.scrollY } }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !p.isDown) return
      cam.scrollX = this.dragStart.cam.x - (p.x - this.dragStart.x) / cam.zoom
      cam.scrollY = this.dragStart.cam.y - (p.y - this.dragStart.y) / cam.zoom
    })
    this.input.on('pointerup', () => { this.isDragging = false })
    this.input.on('pointerupoutside', () => { this.isDragging = false })
    this.input.on('wheel', (_p: unknown, _objs: unknown, _dx: number, dy: number) => {
      const next = Phaser.Math.Clamp(cam.zoom + (dy < 0 ? 0.1 : -0.1), 0.5, 2.0)
      this.tweens.add({ targets: cam, zoom: next, duration: 220, ease: 'Cubic.easeOut' })
    })
  }

  private startIdleCameraDrift() {
    if (this.prefersReducedMotion) return
    const cam = this.cameras.main
    const baseX = cam.scrollX
    this.tweens.add({
      targets: cam, scrollX: baseX + 4,
      duration: 8000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  // ─── Smooth time-of-day transitions ────────────────────────────────────────

  private startTimeOfDayWatcher() {
    let lastLabel = timeOfDay().label
    this.time.addEvent({
      delay: 30_000, loop: true,
      callback: () => {
        const tod = timeOfDay()
        if (tod.label !== lastLabel) {
          this.tweenToTimeOfDay(tod)
          lastLabel = tod.label
        }
      },
    })
  }

  private tweenToTimeOfDay(tod: TimeOfDay) {
    // Tween camera bg
    const cam = this.cameras.main
    const currentBg = cam.backgroundColor
    const fromBg = currentBg
      ? Phaser.Display.Color.IntegerToColor(currentBg.color)
      : Phaser.Display.Color.IntegerToColor(0x0a0e1a)
    const toBg = Phaser.Display.Color.IntegerToColor(tod.ambientBg)
    this.tweens.addCounter({
      from: 0, to: 100, duration: 2400,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0
        const t = v / 100
        const r = Math.round(fromBg.red + (toBg.red - fromBg.red) * t)
        const g = Math.round(fromBg.green + (toBg.green - fromBg.green) * t)
        const b = Math.round(fromBg.blue + (toBg.blue - fromBg.blue) * t)
        cam.setBackgroundColor(Phaser.Display.Color.GetColor(r, g, b))
      },
    })
    // Tween ambient overlay
    this.tweens.add({
      targets: this.ambientOverlay, alpha: tod.ambientOverlayAlpha,
      duration: 2400,
    })
    this.ambientOverlay.setFillStyle(tod.ambientOverlay)
  }

  // ─── Sound (Web Audio, no external files) ──────────────────────────────────

  private initAudio() {
    if (this.audioCtx || typeof window === 'undefined') return
    try {
      this.audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      this.audioGain = this.audioCtx.createGain()
      this.audioGain.gain.value = 0
      this.audioGain.connect(this.audioCtx.destination)
      this.startAmbientHum()
      if (this.audioEnabled) this.fadeAudioTo(0.06)
    } catch { /* unsupported */ }
  }

  private startAmbientHum() {
    if (!this.audioCtx || !this.audioGain) return
    // Brown noise via random buffer
    const bufferSize = this.audioCtx.sampleRate * 2
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate)
    const data = buffer.getChannelData(0)
    let lastOut = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      data[i] = (lastOut + (0.02 * white)) / 1.02
      lastOut = data[i]
      data[i] *= 3.5
    }
    const noise = this.audioCtx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const noiseFilter = this.audioCtx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 220
    noise.connect(noiseFilter).connect(this.audioGain)
    noise.start(0)
  }

  private playEventSound(event: EventKey) {
    if (!this.audioCtx || !this.audioGain) return
    const now = this.audioCtx.currentTime
    const o = this.audioCtx.createOscillator()
    const g = this.audioCtx.createGain()
    let freq = 440
    let type: OscillatorType = 'sine'
    switch (event) {
      case 'task.queued':    freq = 660; break
      case 'task.started':   freq = 540; type = 'triangle'; break
      case 'task.completed': freq = 880; break
      case 'task.failed':    freq = 220; type = 'sawtooth'; break
      case 'github.push':    freq = 720; type = 'square'; break
    }
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.06, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    o.connect(g).connect(this.audioGain)
    o.start(now)
    o.stop(now + 0.4)
  }

  setAudioEnabled(enabled: boolean) {
    this.audioEnabled = enabled
    if (!this.audioCtx) this.initAudio()
    this.fadeAudioTo(enabled ? 0.06 : 0)
  }

  private fadeAudioTo(value: number) {
    if (!this.audioCtx || !this.audioGain) return
    const now = this.audioCtx.currentTime
    this.audioGain.gain.cancelScheduledValues(now)
    this.audioGain.gain.setValueAtTime(this.audioGain.gain.value, now)
    this.audioGain.gain.linearRampToValueAtTime(value, now + 0.8)
  }
}
