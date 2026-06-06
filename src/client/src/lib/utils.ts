import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

export function taskStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400'
    case 'in_progress': return 'text-blue-400'
    case 'queued': return 'text-yellow-400'
    case 'failed': return 'text-red-400'
    case 'cancelled': return 'text-gray-500'
    default: return 'text-gray-400'
  }
}

export function taskStatusLabel(status: string): string {
  switch (status) {
    case 'in_progress': return 'Running'
    case 'queued': return 'Queued'
    case 'completed': return 'Done'
    case 'failed': return 'Failed'
    case 'cancelled': return 'Cancelled'
    default: return status
  }
}
