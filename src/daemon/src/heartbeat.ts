import type { DaemonConfig } from './types.js'

export async function sendHeartbeat(
  config: DaemonConfig,
  activeTaskId: string | null
): Promise<void> {
  try {
    const res = await fetch(`${config.hqUrl}/api/daemon/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.hqApiKey}`,
      },
      body: JSON.stringify({
        daemonId: config.daemonId,
        hostName: process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? 'unknown',
        daemonVersion: '1.0.0',
        activeTaskId,
      }),
    })
    if (!res.ok) {
      console.error(`[heartbeat] HQ returned ${res.status}`)
    }
  } catch (err) {
    console.error('[heartbeat] failed:', (err as Error).message)
  }
}
