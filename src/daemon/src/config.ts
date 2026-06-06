import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface DaemonConfig {
  hqUrl: string
  hqApiKey: string
  redisUrl: string
  daemonId: string
  agentsDir: string
  logLevel: string
  taskTimeoutMs: number
}

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'ClaudeCowork', 'daemon.toml')

function parseToml(content: string): Record<string, string | number> {
  const result: Record<string, string | number> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    const num = Number(value)
    result[key] = isNaN(num) ? value : num
  }
  return result
}

export function loadConfig(configPath?: string): DaemonConfig {
  const filePath = configPath ?? process.env.DAEMON_CONFIG ?? DEFAULT_CONFIG_PATH

  // Environment overrides (for dev/CI)
  if (process.env.HQ_URL) {
    return {
      hqUrl: process.env.HQ_URL!,
      hqApiKey: process.env.HQ_API_KEY!,
      redisUrl: process.env.REDIS_URL!,
      daemonId: process.env.DAEMON_ID ?? 'dev-daemon',
      agentsDir: process.env.AGENTS_DIR ?? path.join(os.homedir(), '.claude', 'agents'),
      logLevel: process.env.LOG_LEVEL ?? 'info',
      taskTimeoutMs: parseInt(process.env.TASK_TIMEOUT_MS ?? '1800000', 10),
    }
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = parseToml(raw)

  return {
    hqUrl: (parsed['hq_url'] as string).replace(/\/$/, ''),
    hqApiKey: parsed['hq_api_key'] as string,
    redisUrl: parsed['redis_url'] as string,
    daemonId: parsed['daemon_id'] as string,
    agentsDir: (parsed['agents_dir'] as string) ?? path.join(os.homedir(), '.claude', 'agents'),
    logLevel: (parsed['log_level'] as string) ?? 'info',
    taskTimeoutMs: (parsed['task_timeout_ms'] as number) ?? 30 * 60 * 1000,
  }
}
