import { Router } from 'express'
import { db } from '../db/index.js'
import { daemonHeartbeats, tasks } from '../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { requireDaemonToken } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'
import { getRedis } from '../services/redis.js'
import { DAEMON_HEARTBEAT_TTL_SECONDS } from '../config/models.js'
import { getIO } from '../socket/index.js'
import type { DaemonHeartbeatBody } from '../../shared/types.js'

const router = Router()

router.post('/heartbeat', requireDaemonToken, async (req, res) => {
  const body = req.body as DaemonHeartbeatBody
  if (!body.daemonId) { res.status(400).json({ error: 'daemonId required' }); return }

  await db.insert(daemonHeartbeats).values({
    daemonId: body.daemonId,
    hostName: body.hostName,
    daemonVersion: body.daemonVersion,
    activeTaskId: body.activeTaskId ?? null,
    reportedAt: new Date(),
  })

  const redis = getRedis()
  await redis.setex(
    `daemon:heartbeat:${body.daemonId}`,
    DAEMON_HEARTBEAT_TTL_SECONDS,
    JSON.stringify({
      daemonId: body.daemonId,
      hostName: body.hostName,
      daemonVersion: body.daemonVersion,
      activeTaskId: body.activeTaskId ?? null,
      lastSeenAt: new Date().toISOString(),
    })
  )

  getIO().to('global').emit('daemon.status', {
    online: true,
    daemonId: body.daemonId,
    hostName: body.hostName ?? null,
    daemonVersion: body.daemonVersion ?? null,
    lastSeenAt: new Date().toISOString(),
    activeTaskId: body.activeTaskId ?? null,
  })

  res.json({ ok: true })
})

router.get('/status', requireAuth, async (_req, res) => {
  const redis = getRedis()
  const keys = await redis.keys('daemon:heartbeat:*')
  if (keys.length === 0) {
    res.json({ online: false, daemonId: null, hostName: null, daemonVersion: null, lastSeenAt: null, activeTaskId: null })
    return
  }
  const raw = await redis.get(keys[0])
  if (!raw) {
    res.json({ online: false, daemonId: null, hostName: null, daemonVersion: null, lastSeenAt: null, activeTaskId: null })
    return
  }
  res.json({ online: true, ...JSON.parse(raw) })
})

// Recovery: mark stuck in_progress tasks as failed when daemon restarts
router.post('/recover', requireDaemonToken, async (req, res) => {
  const { daemonId } = req.body as { daemonId?: string }
  if (!daemonId) { res.status(400).json({ error: 'daemonId required' }); return }

  const { inArray } = await import('drizzle-orm')
  const stuckTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'in_progress'),
        eq(tasks.daemonSessionId, daemonId)
      )
    )

  for (const task of stuckTasks) {
    await db.update(tasks).set({
      status: 'failed',
      errorMessage: 'Daemon restarted mid-task',
      completedAt: new Date(),
    }).where(eq(tasks.id, task.id))
    getIO().to(`project:${task.projectId}`).emit('task.failed', {
      taskId: task.id,
      errorMessage: 'Daemon restarted mid-task',
    })
  }

  res.json({ recovered: stuckTasks.length })
})

export default router
