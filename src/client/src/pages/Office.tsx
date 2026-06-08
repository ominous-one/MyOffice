import { Suspense, lazy, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { OfficeHUD } from '../office/OfficeHUD'
import type { Project } from '../../../shared/types'

type EventKey = 'task.queued' | 'task.started' | 'task.completed' | 'task.failed' | 'github.push'
interface OfficeEvent { projectId: string; event: EventKey; ts: number }

const PhaserHost = lazy(() =>
  import('../office/PhaserHost').then(m => ({ default: m.PhaserHost }))
)

export function Office() {
  const navigate = useNavigate()
  const { socket } = useSocket()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [lastEvent, setLastEvent] = useState<OfficeEvent | null>(null)
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('office.audio') === 'on'
  })
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

  const toggleAudio = () => {
    setAudioEnabled(v => {
      const next = !v
      try { window.localStorage.setItem('office.audio', next ? 'on' : 'off') } catch {}
      return next
    })
  }

  useEffect(() => {
    if (isMobile) {
      navigate('/grid', { replace: true })
      return
    }
    fetch('/api/projects', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Project[]) => setProjects(data.filter(p => p.status === 'active')))
      .finally(() => setLoading(false))
  }, [isMobile, navigate])

  useEffect(() => {
    if (!socket) return
    const onProjectEvent = (event: EventKey) => ({ projectId }: { projectId: string }) =>
      setLastEvent({ projectId, event, ts: Date.now() })

    socket.on('task.queued', onProjectEvent('task.queued'))
    socket.on('task.started', onProjectEvent('task.started'))
    socket.on('task.completed', onProjectEvent('task.completed'))
    socket.on('task.failed', onProjectEvent('task.failed'))
    socket.on('activity.new', ({ item }: { item: { projectId: string; source: string } }) => {
      if (item.source === 'github') setLastEvent({ projectId: item.projectId, event: 'github.push', ts: Date.now() })
    })
    return () => {
      socket.off('task.queued')
      socket.off('task.started')
      socket.off('task.completed')
      socket.off('task.failed')
      socket.off('activity.new')
    }
  }, [socket])

  if (isMobile) return null

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[var(--muted)]">
        Loading office…
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center text-[var(--muted)]">
            Building the office…
          </div>
        }
      >
        <PhaserHost
          projects={projects}
          lastEvent={lastEvent}
          audioEnabled={audioEnabled}
          onDeskClick={(id) => navigate(`/project/${id}`)}
        />
      </Suspense>
      <OfficeHUD projects={projects} audioEnabled={audioEnabled} onToggleAudio={toggleAudio} />
      <button
        onClick={() => navigate('/grid')}
        className="absolute bottom-20 right-3 z-30 text-xs px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
      >
        Grid view
      </button>
    </div>
  )
}
