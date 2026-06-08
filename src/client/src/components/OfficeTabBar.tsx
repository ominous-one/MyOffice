import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Sparkles, Home } from 'lucide-react'
import type { Project } from '../../../shared/types'

export function OfficeTabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    fetch('/api/projects', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Project[]) => setProjects(data.filter(p => p.status === 'active')))
      .catch(() => {})
  }, [])

  // Hide on login
  if (location.pathname === '/login') return null

  const activeProjectId = location.pathname.startsWith('/project/')
    ? location.pathname.slice('/project/'.length)
    : null
  const isHome = location.pathname === '/' || location.pathname === '/grid'

  return (
    <nav
      className="flex-shrink-0 flex items-stretch border-t border-[var(--border)] bg-[var(--surface)] overflow-x-auto snap-x snap-mandatory"
      aria-label="Office tabs"
    >
      {/* Jarvis anchor — does NOT scroll, sits in its own non-scrolling cell at left */}
      <button
        onClick={() => navigate('/')}
        className={`sticky left-0 z-10 flex items-center gap-1.5 px-3 min-h-[44px] bg-[var(--surface)] border-r border-[var(--border)] snap-start ${
          isHome ? 'text-brand-400' : 'text-[var(--muted)] hover:text-[var(--text)]'
        }`}
        title="Office (Jarvis)"
      >
        <Sparkles size={14} />
        <span className="text-xs font-semibold hidden sm:inline">Jarvis</span>
      </button>

      {projects.length === 0 && (
        <div className="flex items-center px-3 text-xs text-[var(--muted)]">
          <Home size={12} className="mr-1.5" />
          No projects yet
        </div>
      )}

      {projects.map(p => {
        const active = activeProjectId === p.id
        return (
          <button
            key={p.id}
            onClick={() => navigate(`/project/${p.id}`)}
            className={`flex items-center gap-2 px-3 min-h-[44px] whitespace-nowrap border-r border-[var(--border)] snap-start ${
              active
                ? 'bg-[var(--bg)] text-[var(--text)] border-b-2 border-b-brand-500'
                : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]'
            }`}
            title={p.localPath ?? p.name}
          >
            <span
              className="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-xs font-medium">{p.name}</span>
          </button>
        )
      })}
    </nav>
  )
}
