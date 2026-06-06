export interface DaemonConfig {
  hqUrl: string
  hqApiKey: string
  redisUrl: string
  daemonId: string
  agentsDir: string
  logLevel: string
  taskTimeoutMs: number
}

export interface TaskJob {
  taskId: string
  projectId: string
  localPath: string
  prompt: string
  websearchEnabled: boolean
}
