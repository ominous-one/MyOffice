import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { formatRelative } from '../lib/utils'
import type { Project, BriefingGeneration } from '../../../shared/types'
import { Plus, FolderOpen, Circle, X, ChevronRight, Sparkles } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

export function Dashboard() {
  const navigate = useNavigate()
  const { connected } = useSocket()
  const [projects, setProjects] = useState<Project[]>([])
  const [briefing, setBriefing] = useState<BriefingGeneration | null | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', localPath: '', repoUrl: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/projects', { credentials: 'include' })
      .then((r) => r.json())
      .then(setProjects)
  }, [])

  useEffect(() => {
    // Try cached briefing first, then generate if missing
    fetch('/api/briefing/today', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: BriefingGeneration | null) => {
        if (data && !data.dismissedAt) {
          setBriefing(data)
        } else if (!data) {
          fetch('/api/briefing/generate', { method: 'POST', credentials: 'include' })
            .then((r) => r.json())
            .then((generated: BriefingGeneration) => {
              if (generated?.content) setBriefing(generated)
              else setBriefing(null)
            })
            .catch(() => setBriefing(null))
        } else {
          setBriefing(null)
        }
      })
      .catch(() => setBriefing(null))
  }, [])

  async function dismissBriefing() {
    if (!briefing) return
    await fetch(`/api/briefing/${briefing.id}/dismiss`, { method: 'POST', credentials: 'include' })
    setBriefing(null)
  }

  async function createProject(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.localPath.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          localPath: form.localPath.trim(),
          repoUrl: form.repoUrl.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create project')
        return
      }
      const project = await res.json()
      setProjects((prev) => [project, ...prev])
      setDialogOpen(false)
      setForm({ name: '', localPath: '', repoUrl: '' })
    } finally {
      setSubmitting(false)
    }
  }

  function Sprite({ n }: { n: 1 | 2 | 3 | 4 }) {
    return (
      <div className={`sprite sprite-${n}`}>
        <div className="sprite-head" />
        <div className="sprite-body" />
        <div className="sprite-legs">
          <div className="sprite-leg" />
          <div className="sprite-leg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <div>
          <h1 className="font-semibold text-lg">HQ Dashboard</h1>
          <p className="text-xs text-[var(--muted)]">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${connected ? 'text-green-500' : 'text-[var(--muted)]'}`}>
            {connected ? 'Live' : 'Connecting…'}
          </span>
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Trigger asChild>
              <button className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={14} /> Add project
              </button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
              <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md surface rounded-xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="font-semibold">New project</Dialog.Title>
                  <Dialog.Close className="text-[var(--muted)] hover:text-[var(--text)]"><X size={16} /></Dialog.Close>
                </div>

                <form onSubmit={createProject} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Project name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="My Project"
                      autoFocus
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm
                                 focus:outline-none focus:border-brand-500 placeholder:text-[var(--muted)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Local path (WSL)</label>
                    <input
                      value={form.localPath}
                      onChange={(e) => setForm({ ...form, localPath: e.target.value })}
                      placeholder="/home/ominous/projects/my-project"
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm
                                 focus:outline-none focus:border-brand-500 placeholder:text-[var(--muted)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">GitHub repo URL <span className="text-[var(--muted)] font-normal">(optional)</span></label>
                    <input
                      value={form.repoUrl}
                      onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
                      placeholder="https://github.com/ominous-one/my-project"
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm
                                 focus:outline-none focus:border-brand-500 placeholder:text-[var(--muted)]"
                    />
                  </div>
                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <div className="flex gap-2 pt-1">
                    <Dialog.Close asChild>
                      <button type="button" className="flex-1 surface hover:border-gray-500 py-2 rounded-lg text-sm transition-colors">Cancel</button>
                    </Dialog.Close>
                    <button
                      type="submit"
                      disabled={submitting || !form.name.trim() || !form.localPath.trim()}
                      className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm transition-colors"
                    >
                      {submitting ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>

      {/* Jarvis morning briefing banner */}
      {briefing && (
        <div className="mx-4 mt-4 rounded-xl border border-brand-700/50 bg-brand-950/40 px-4 py-3 flex items-start gap-3 animate-fade-in flex-shrink-0">
          <Sparkles size={16} className="text-brand-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[var(--text)] flex-1 leading-relaxed">{briefing.content}</p>
          <button
            onClick={dismissBriefing}
            className="text-[var(--muted)] hover:text-[var(--text)] transition-colors flex-shrink-0"
            aria-label="Dismiss briefing"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Project grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
            <FolderOpen size={48} className="text-[var(--border)]" />
            <div>
              <p className="font-medium">No projects yet</p>
              <p className="text-sm text-[var(--muted)] mt-1">Add your first project to get started.</p>
            </div>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm px-4 py-2 rounded-lg transition-colors mt-2"
            >
              <Plus size={14} /> Add project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className="surface rounded-xl p-4 text-left hover:border-brand-700 transition-all group animate-fade-in"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Circle
                      size={8}
                      className={p.status === 'active' ? 'fill-green-500 text-green-500' : 'fill-gray-600 text-gray-600'}
                    />
                    <span className="font-medium text-sm">{p.name}</span>
                  </div>
                  <ChevronRight size={14} className="text-[var(--muted)] group-hover:text-[var(--text)] transition-colors" />
                </div>
                <p className="text-xs text-[var(--muted)] font-mono truncate mb-2">{p.localPath}</p>
                {p.repoUrl && (
                  <p className="text-xs text-[var(--muted)] truncate mb-2">{p.repoUrl.replace('https://github.com/', 'github: ')}</p>
                )}
                <p className="text-xs text-[var(--muted)]">Active {formatRelative(p.lastActiveAt)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Office floor — 4 animated sprites (UU-7 visual spike) */}
      <div className="office-floor">
        <Sprite n={1} />
        <Sprite n={2} />
        <Sprite n={3} />
        <Sprite n={4} />
      </div>
    </div>
  )
}
