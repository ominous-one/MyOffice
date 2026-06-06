export const MODEL_BY_AGENT_TIER = {
  jarvis_briefing: 'claude-opus-4-7',
  jarvis_ambient: 'claude-sonnet-4-6',
  project_ceo: 'claude-sonnet-4-6',
  director: 'claude-sonnet-4-6',
} as const

export type AgentTierKey = keyof typeof MODEL_BY_AGENT_TIER

export const MAX_HISTORY_MESSAGES = 200
export const MAX_TOKENS_PER_RESPONSE = 4096
export const TASK_TIMEOUT_MS = 30 * 60 * 1000
export const DAEMON_HEARTBEAT_TTL_SECONDS = 60
export const DAEMON_HEARTBEAT_INTERVAL_MS = 30_000
export const BRIEFING_GAP_HOURS = 6
export const CHECKIN_GAP_HOURS = 48
export const CHECKIN_DISMISS_COOLDOWN_DAYS = 7
export const PROJECT_SOFT_DELETE_DAYS = 30
export const TASK_TRANSCRIPT_MAX_BYTES = 10 * 1024 * 1024
