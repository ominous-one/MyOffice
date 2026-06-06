import { useState } from 'react'
import { cn, formatRelative, taskStatusColor, taskStatusLabel } from '../lib/utils'
import type { Task } from '../../../shared/types'
import { ChevronDown, ChevronRight, X } from 'lucide-react'

interface Props {
  task: Task
  onCancel?: (id: string) => void
  liveOutput?: string
}

export function TaskItem({ task, onCancel, liveOutput }: Props) {
  const [expanded, setExpanded] = useState(false)

  const transcript = liveOutput ?? task.transcript ?? ''
  const hasOutput = transcript.length > 0

  return (
    <div className={cn(
      'surface rounded-lg p-3 space-y-1.5 transition-all',
      task.status === 'in_progress' && 'border-blue-800'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {hasOutput && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 text-[var(--muted)] hover:text-[var(--text)] flex-shrink-0"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{task.title}</p>
            <p className="text-xs text-[var(--muted)]">
              <span className={taskStatusColor(task.status)}>{taskStatusLabel(task.status)}</span>
              {' · '}
              {formatRelative(task.createdAt)}
            </p>
          </div>
        </div>

        {['queued', 'in_progress'].includes(task.status) && onCancel && (
          <button
            onClick={() => onCancel(task.id)}
            className="text-[var(--muted)] hover:text-red-400 flex-shrink-0 transition-colors"
            title="Cancel task"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {task.status === 'in_progress' && !expanded && (
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-blue-400 animate-status-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-[var(--muted)]">Running…</span>
        </div>
      )}

      {expanded && hasOutput && (
        <pre className="transcript bg-[var(--bg)] rounded p-2 max-h-64 overflow-y-auto text-xs text-gray-300 mt-2">
          {transcript}
        </pre>
      )}

      {task.status === 'failed' && task.errorMessage && (
        <p className="text-xs text-red-400 mt-1">{task.errorMessage}</p>
      )}
    </div>
  )
}
