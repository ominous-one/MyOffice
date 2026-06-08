import { useEffect, useState, useRef, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import { TaskItem } from '../components/TaskItem'
import { formatRelative } from '../lib/utils'
import type { Project, Task, ConversationMessage, ActivityFeedItem } from '../../../shared/types'
import { Send, CheckSquare, MessageSquare, Zap, GitCommit, RefreshCw, ExternalLink } from 'lucide-react'

type TabId = 'tasks' | 'chat' | 'activity'

export function Workstation() {
  const { id: projectId } = useParams<{ id: string }>()
  const { socket } = useSocket()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [activity, setActivity] = useState<ActivityFeedItem[]>([])
  const [syncingGithub, setSyncingGithub] = useState(false)
  const [liveOutputs, setLiveOutputs] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<TabId>('tasks')
  const [taskInput, setTaskInput] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pendingMsg, setPendingMsg] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load initial data
  useEffect(() => {
    if (!projectId) return
    Promise.all([
      fetch(`/api/projects/${projectId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/tasks`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/messages`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/activity`, { credentials: 'include' }).then((r) => r.json()),
    ]).then(([p, t, m, a]) => {
      setProject(p)
      setTasks(t)
      setMessages(m)
      setActivity(Array.isArray(a) ? a : [])
    })
  }, [projectId])

  // Socket events for this project
  useEffect(() => {
    if (!socket || !projectId) return
    socket.emit('project.open', { projectId })

    socket.on('task.queued', ({ task }) => {
      if (task.projectId === projectId) setTasks((prev) => [task, ...prev])
    })
    socket.on('task.started', ({ taskId, startedAt }) => {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'in_progress', startedAt } : t))
    })
    socket.on('task.output', ({ taskId, chunk }) => {
      if (!tasks.find((t) => t.id === taskId && t.projectId === projectId)) return
      setLiveOutputs((prev) => ({ ...prev, [taskId]: (prev[taskId] ?? '') + chunk }))
    })
    socket.on('task.completed', ({ taskId, exitCode, summary }) => {
      setTasks((prev) => prev.map((t) =>
        t.id === taskId ? { ...t, status: 'completed', exitCode, outputSummary: summary, completedAt: new Date().toISOString() } : t
      ))
    })
    socket.on('task.failed', ({ taskId, errorMessage }) => {
      setTasks((prev) => prev.map((t) =>
        t.id === taskId ? { ...t, status: 'failed', errorMessage, completedAt: new Date().toISOString() } : t
      ))
    })
    socket.on('task.cancelled', ({ taskId }) => {
      setTasks((prev) => prev.map((t) =>
        t.id === taskId ? { ...t, status: 'cancelled', completedAt: new Date().toISOString() } : t
      ))
    })
    socket.on('message.appended', ({ message }) => {
      if (message.projectId === projectId) setMessages((prev) => [...prev, message])
    })
    socket.on('message.token', ({ id, delta }) => {
      setPendingMsg((prev) => (prev ?? '') + delta)
    })
    socket.on('message.complete', ({ message }) => {
      if (message.projectId === projectId) {
        setMessages((prev) => [...prev, message])
        setPendingMsg(null)
        setStreaming(false)
      }
    })

    return () => {
      socket.emit('project.close', { projectId })
      socket.off('task.queued')
      socket.off('task.started')
      socket.off('task.output')
      socket.off('task.completed')
      socket.off('task.failed')
      socket.off('task.cancelled')
      socket.off('message.appended')
      socket.off('message.token')
      socket.off('message.complete')
    }
  }, [socket, projectId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingMsg])

  async function dispatchTask(e: FormEvent) {
    e.preventDefault()
    if (!taskInput.trim() || !projectId) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        projectId,
        title: taskTitle.trim() || taskInput.trim().slice(0, 60),
        prompt: taskInput.trim(),
      }),
    })
    setTaskInput('')
    setTaskTitle('')
  }

  function sendChat(e: FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || !socket || streaming) return
    setStreaming(true)
    socket.emit('chat.send', { projectId, content: chatInput.trim() })
    setMessages((prev) => [...prev, {
      id: 'pending-' + Date.now(),
      scope: 'project',
      projectId: projectId!,
      agentId: 'user',
      role: 'user',
      content: chatInput.trim(),
      taskId: null, model: null, inputTokens: null, outputTokens: null,
      createdAt: new Date().toISOString(),
    }])
    setChatInput('')
  }

  function cancelTask(taskId: string) {
    fetch(`/api/tasks/${taskId}/cancel`, { method: 'POST', credentials: 'include' })
  }

  async function syncGithub() {
    if (!projectId || syncingGithub) return
    setSyncingGithub(true)
    try {
      await fetch(`/api/projects/${projectId}/sync-github`, { method: 'POST', credentials: 'include' })
      const fresh = await fetch(`/api/projects/${projectId}/activity`, { credentials: 'include' }).then((r) => r.json())
      setActivity(Array.isArray(fresh) ? fresh : [])
    } finally {
      setSyncingGithub(false)
    }
  }

  if (!project) {
    return <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">Loading…</div>
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <div>
          <h2 className="font-semibold">{project.name}</h2>
          <p className="text-xs text-[var(--muted)]">{project.localPath}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
          <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`} />
          {project.status}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)] flex-shrink-0">
        {([['tasks', CheckSquare, 'Tasks'], ['chat', MessageSquare, 'Chat'], ['activity', GitCommit, 'Activity']] as const).map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
              tab === id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <div className="flex flex-col min-h-0 flex-1">
          <form onSubmit={dispatchTask} className="p-3 space-y-2 border-b border-[var(--border)] flex-shrink-0">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task title (optional)"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:border-brand-500 placeholder:text-[var(--muted)]"
            />
            <div className="flex gap-2">
              <textarea
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Describe the task for Claude…"
                rows={2}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) dispatchTask(e as unknown as FormEvent) }}
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:border-brand-500 placeholder:text-[var(--muted)] resize-none"
              />
              <button
                type="submit"
                disabled={!taskInput.trim()}
                className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50
                           text-white px-3 rounded-lg transition-colors text-sm self-end py-2"
              >
                <Zap size={14} /> Run
              </button>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tasks.length === 0 ? (
              <p className="text-center text-[var(--muted)] text-sm py-8">No tasks yet. Dispatch one above.</p>
            ) : (
              tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onCancel={cancelTask}
                  liveOutput={liveOutputs[task.id]}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat tab */}
      {tab === 'chat' && (
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-[var(--muted)] text-sm py-8">Ask the project CEO anything.</p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-brand-700 text-white'
                    : 'surface text-[var(--text)]'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-50 mt-1">{formatRelative(msg.createdAt)}</p>
                </div>
              </div>
            ))}
            {pendingMsg !== null && (
              <div className="flex justify-start">
                <div className="surface max-w-[80%] rounded-xl px-3 py-2 text-sm">
                  <p className="whitespace-pre-wrap">{pendingMsg}<span className="animate-pulse">▊</span></p>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendChat} className="p-3 border-t border-[var(--border)] flex gap-2 flex-shrink-0">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message the CEO…"
              disabled={streaming}
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:border-brand-500 placeholder:text-[var(--muted)]
                         disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || streaming}
              className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Activity tab */}
      {tab === 'activity' && (
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
            <span className="text-xs text-[var(--muted)]">
              {activity.length > 0 ? `${activity.length} commits` : 'No activity yet'}
            </span>
            {project.githubOwner && project.githubRepo ? (
              <button
                onClick={syncGithub}
                disabled={syncingGithub}
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={12} className={syncingGithub ? 'animate-spin' : ''} />
                {syncingGithub ? 'Syncing…' : 'Sync'}
              </button>
            ) : (
              <span className="text-xs text-[var(--muted)]">No GitHub repo configured</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {activity.length === 0 ? (
              <div className="text-center text-[var(--muted)] text-sm py-8">
                {project.githubOwner
                  ? 'No commits synced yet. Click Sync to pull from GitHub.'
                  : 'Add a GitHub repo URL to this project to see commit history.'}
              </div>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-[var(--border)]/50 last:border-0">
                  <GitCommit size={13} className="text-[var(--muted)] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug truncate">{item.summary}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{formatRelative(item.occurredAt)}</p>
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--muted)] hover:text-brand-400 transition-colors flex-shrink-0"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
