import Redis from 'ioredis'
import { Worker } from 'bullmq'
import { loadConfig } from './config.js'
import { sendHeartbeat } from './heartbeat.js'
import { runTask } from './task-runner.js'
import { syncAgents, watchAgents } from './agent-sync.js'
import type { TaskJob } from './types.js'

async function main() {
  console.log('[daemon] starting MyOffice daemon v1.0.0')

  const config = loadConfig()
  console.log(`[daemon] connecting to HQ: ${config.hqUrl}`)
  console.log(`[daemon] daemon ID: ${config.daemonId}`)

  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })

  redis.on('connect', () => console.log('[daemon] redis connected'))
  redis.on('error', (err) => console.error('[daemon] redis error:', err.message))

  // Initial agent sync + file watcher
  await syncAgents(config)
  watchAgents(config)

  // Heartbeat loop
  let activeTaskId: string | null = null
  const heartbeatInterval = setInterval(() => {
    sendHeartbeat(config, activeTaskId)
  }, 30_000)
  await sendHeartbeat(config, null)

  // BullMQ worker — pops tasks from Redis queue
  const worker = new Worker<TaskJob>('tasks', async (job) => {
    const { taskId } = job.data
    console.log(`[daemon] picked up task ${taskId}`)
    activeTaskId = taskId
    try {
      await runTask(job.data, config, redis)
    } finally {
      activeTaskId = null
    }
    console.log(`[daemon] task ${taskId} finished`)
  }, {
    connection: {
      url: config.redisUrl,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    },
    concurrency: 1,
  })

  worker.on('failed', (job, err) => {
    console.error(`[daemon] worker error on job ${job?.id}:`, err.message)
    activeTaskId = null
  })

  // Recovery: find any tasks stuck in_progress from a previous daemon crash and mark them failed
  try {
    const res = await fetch(`${config.hqUrl}/api/daemon/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.hqApiKey}`,
      },
      body: JSON.stringify({ daemonId: config.daemonId }),
    })
    if (res.ok) console.log('[daemon] recovery complete')
  } catch {
    // HQ may not have this endpoint yet; ignore
  }

  console.log('[daemon] ready — listening for tasks')

  process.on('SIGTERM', async () => {
    console.log('[daemon] shutting down gracefully')
    clearInterval(heartbeatInterval)
    await worker.close()
    redis.disconnect()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[daemon] fatal:', err)
  process.exit(1)
})
