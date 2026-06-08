import { useEffect, useRef, useState } from 'react'
import type { Project, DaemonStatus } from '../../../shared/types'
import { useSocket } from '../hooks/useSocket'
import { Sparkles, Building2, Wifi, WifiOff, Volume2, VolumeX } from 'lucide-react'

interface Props {
  projects: Project[]
  audioEnabled: boolean
  onToggleAudio: () => void
}

export function OfficeHUD({ projects, audioEnabled, onToggleAudio }: Props) {
  const { socket } = useSocket()
  const [now, setNow] = useState(() => new Date())
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!socket) return
    const onStatus = (s: DaemonStatus) => setDaemon(s)
    socket.on('daemon.status', onStatus)
    fetch('/api/daemon/status', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s) setDaemon(s) })
      .catch(() => {})
    return () => { socket.off('daemon.status', onStatus) }
  }, [socket])

  const todBand = todLabel(now.getHours())

  return (
    <>
      {/* Top-left: clock + time-of-day */}
      <div className="pointer-events-none absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b0f1a]/80 border border-[var(--border)] backdrop-blur">
        <span className="text-xs text-[var(--muted)] uppercase tracking-wider">{todBand}</span>
        <span className="font-mono text-sm text-[var(--text)]">{formatTime(now)}</span>
      </div>

      {/* Top-center: org banner */}
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-[#0b0f1a]/80 border border-[var(--border)] backdrop-blur">
        <Building2 size={14} className="text-brand-400" />
        <span className="text-xs font-semibold tracking-wide">MyOffice HQ</span>
        <span className="text-xs text-[var(--muted)]">·</span>
        <span className="text-xs text-emerald-400">{projects.length} active</span>
      </div>

      {/* Top-right cluster: daemon + audio + minimap */}
      <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleAudio}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#0b0f1a]/80 border border-[var(--border)] backdrop-blur text-[var(--muted)] hover:text-[var(--text)]"
            title={audioEnabled ? 'Mute office ambience' : 'Enable office ambience'}
            aria-label={audioEnabled ? 'Mute office' : 'Unmute office'}
          >
            {audioEnabled ? <Volume2 size={12} className="text-emerald-400" /> : <VolumeX size={12} />}
            <span className="text-[10px]">{audioEnabled ? 'Sound on' : 'Sound off'}</span>
          </button>
          <div className="pointer-events-none flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0b0f1a]/80 border border-[var(--border)] backdrop-blur">
            {daemon?.online ? (
              <>
                <Wifi size={12} className="text-emerald-400" />
                <span className="text-[10px] text-emerald-300">Daemon {daemon.daemonId}</span>
              </>
            ) : (
              <>
                <WifiOff size={12} className="text-amber-400" />
                <span className="text-[10px] text-amber-300">Daemon offline</span>
              </>
            )}
          </div>
        </div>
        <Minimap projects={projects} />
      </div>

      {/* Bottom-left: Sims-style cue */}
      <div className="pointer-events-none absolute bottom-20 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0b0f1a]/70 border border-[var(--border)] backdrop-blur">
        <Sparkles size={12} className="text-brand-400" />
        <span className="text-[10px] text-[var(--muted)]">drag to pan · scroll to zoom · click a desk to enter</span>
      </div>
    </>
  )
}

function todLabel(h: number) {
  if (h >= 6 && h < 10) return 'morning'
  if (h >= 10 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'dusk'
  return 'night'
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function Minimap({ projects }: { projects: Project[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const W = c.width, H = c.height
    ctx.clearRect(0, 0, W, H)
    // Floor diamond
    ctx.fillStyle = '#1a2236'
    ctx.beginPath()
    ctx.moveTo(W / 2, 6)
    ctx.lineTo(W - 6, H / 2)
    ctx.lineTo(W / 2, H - 6)
    ctx.lineTo(6, H / 2)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.stroke()

    // Zone bands
    ctx.fillStyle = 'rgba(124,58,237,0.25)' // exec
    ctx.fillRect(6, 8, W - 12, H * 0.28)
    ctx.fillStyle = 'rgba(245,158,11,0.18)' // dev
    ctx.fillRect(6, 8 + H * 0.28, W - 12, H * 0.40)
    ctx.fillStyle = 'rgba(16,185,129,0.18)' // lounge
    ctx.fillRect(6, 8 + H * 0.68, W - 12, H * 0.28)

    // Desk dots
    projects.forEach((p, i) => {
      const slot = i
      const isExec = slot < 4
      const isDev = !isExec && slot < 14
      const y = isExec ? 18 : isDev ? H * 0.5 : H * 0.85
      const col = isExec ? slot : isDev ? (slot - 4) % 5 : (slot - 14) % 4
      const x = 14 + col * ((W - 28) / 5)
      ctx.fillStyle = p.status === 'active' ? '#10b981' : p.status === 'archived' ? '#64748b' : '#f59e0b'
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    })

    // Jarvis dot
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(W - 10, H - 10, 3, 0, Math.PI * 2)
    ctx.fill()
  }, [projects])

  return (
    <div className="pointer-events-none rounded-lg bg-[#0b0f1a]/80 border border-[var(--border)] backdrop-blur p-2">
      <p className="text-[9px] text-[var(--muted)] uppercase tracking-wider mb-1">Floor map</p>
      <canvas ref={canvasRef} width={120} height={80} className="block rounded" />
    </div>
  )
}
