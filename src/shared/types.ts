export type ProjectStatus = 'active' | 'paused' | 'archived'
export type TaskStatus = 'queued' | 'in_progress' | 'completed' | 'cancelled' | 'failed'
export type MessageRole = 'user' | 'agent' | 'system'
export type MessageScope = 'project' | 'global'
export type ActivitySource = 'github' | 'render'
export type FetchStatus = 'success' | 'stale' | 'failed' | 'rate_limited'
export type AgentTier = 'jarvis' | 'ceo' | 'director'

export interface Project {
  id: string
  name: string
  localPath: string
  repoUrl: string | null
  githubOwner: string | null
  githubRepo: string | null
  renderServiceId: string | null
  status: ProjectStatus
  websearchEnabled: boolean
  githubReachable: boolean
  lastGithubSyncAt: string | null
  lastRenderSyncAt: string | null
  lastActiveAt: string
  lastCheckinAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Task {
  id: string
  projectId: string
  title: string
  prompt: string
  status: TaskStatus
  daemonSessionId: string | null
  exitCode: number | null
  errorMessage: string | null
  outputSummary: string | null
  transcript: string | null
  truncated: boolean
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface ConversationMessage {
  id: string
  scope: MessageScope
  projectId: string | null
  agentId: string
  role: MessageRole
  content: string
  taskId: string | null
  model: string | null
  inputTokens: number | null
  outputTokens: number | null
  createdAt: string
}

export interface CheckpointSave {
  id: string
  projectId: string
  label: string
  gitSha: string
  notes: string | null
  createdAt: string
}

export interface ActivityFeedItem {
  id: string
  projectId: string
  source: ActivitySource
  eventType: string
  externalId: string
  summary: string
  url: string | null
  metadata: Record<string, unknown> | null
  occurredAt: string
  fetchedAt: string
}

export interface AgentDefinition {
  id: string
  filename: string
  name: string
  tier: AgentTier
  modelOverride: string | null
  persona: string
  sourcePath: string
  contentHash: string
  syncedAt: string
  deletedAt: string | null
}

export interface DaemonStatus {
  online: boolean
  daemonId: string | null
  hostName: string | null
  daemonVersion: string | null
  lastSeenAt: string | null
  activeTaskId: string | null
}

export interface BriefingGeneration {
  id: string
  briefingDate: string
  triggeredAt: string
  triggerReason: string
  content: string
  model: string
  inputTokens: number
  outputTokens: number
  dismissedAt: string | null
}

// Socket.IO event payloads
export interface SocketEvents {
  // server → client
  'task.queued': { task: Task }
  'task.started': { taskId: string; startedAt: string }
  'task.output': { taskId: string; stream: 'stdout' | 'stderr'; chunk: string }
  'task.completed': { taskId: string; exitCode: number; summary: string | null }
  'task.failed': { taskId: string; errorMessage: string }
  'task.cancelled': { taskId: string }
  'message.appended': { message: ConversationMessage }
  'message.token': { id: string; delta: string }
  'message.complete': { message: ConversationMessage }
  'project.updated': { project: Project }
  'checkpoint.created': { checkpoint: CheckpointSave }
  'activity.new': { feedItem: ActivityFeedItem }
  'daemon.status': DaemonStatus
  'briefing.token': { briefingId: string; chunk: string }
  'briefing.complete': { briefingId: string }

  // client → server
  'chat.send': { projectId: string | null; content: string }
  'task.dispatch': { projectId: string; prompt: string; title: string }
  'task.cancel': { taskId: string }
  'checkpoint.create': { projectId: string; label: string; notes?: string }
  'project.open': { projectId: string }
  'project.close': { projectId: string }
}

// API request/response shapes
export interface CreateProjectBody {
  name: string
  localPath: string
  repoUrl?: string
  renderServiceId?: string
  websearchEnabled?: boolean
}

export interface UpdateProjectBody {
  name?: string
  repoUrl?: string
  renderServiceId?: string
  websearchEnabled?: boolean
  status?: ProjectStatus
}

export interface DispatchTaskBody {
  projectId: string
  title: string
  prompt: string
}

export interface CreateCheckpointBody {
  projectId: string
  label: string
  gitSha: string
  notes?: string
}

export interface AgentSyncBody {
  filename: string
  name: string
  tier?: AgentTier
  modelOverride?: string | null
  persona: string
  rawContent: string
  sourcePath: string
  contentHash: string
}

export interface DaemonHeartbeatBody {
  daemonId: string
  hostName?: string
  daemonVersion?: string
  activeTaskId?: string | null
}

export interface TaskProgressBody {
  taskId: string
  stream: 'stdout' | 'stderr'
  chunk: string
}

export interface TaskStatusUpdateBody {
  taskId: string
  status: TaskStatus
  exitCode?: number
  errorMessage?: string
  outputSummary?: string
  transcript?: string
  truncated?: boolean
  daemonSessionId?: string
  startedAt?: string
  completedAt?: string
}
