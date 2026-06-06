import { useEffect, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import type { DaemonStatus as DaemonStatusType } from '../../../shared/types'

export function DaemonStatus() {
  const { socket } = useSocket()
  const [status, setStatus] = useState<DaemonStatusType | null>(null)

  useEffect(() => {
    fetch('/api/daemon/status', { credentials: 'include' })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('daemon.status', setStatus)
    return () => { socket.off('daemon.status', setStatus) }
  }, [socket])

  if (!status) return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
      <span className={`w-2 h-2 rounded-full ${status.online ? 'bg-green-500 animate-status-pulse' : 'bg-red-500'}`} />
      <span>{status.online ? `Daemon online${status.hostName ? ` · ${status.hostName}` : ''}` : 'Daemon offline — tasks queued'}</span>
    </div>
  )
}
