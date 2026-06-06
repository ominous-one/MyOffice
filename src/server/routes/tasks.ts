import { Router } from 'express'
import { db } from '../db/index.js'
import { tasks, projects } from '../db/schema.js'
import { eq, and, isNull } from 'drizzle-orm'
import { requireAuth, requireDaemonToken } from '../middleware/auth.js'
import { getTaskQueue } from '../services/queue.js'
import type { DispatchTaskBody, TaskStatusUpdateBody } from '../../shared/types.js'
import { getIO } from '../socket/index.js'

const router = Router()

// Dispatch a new task (operator → browser → here → BullMQ)
router.post('/', requireAuth, async (req, res) => {
  const body = req.body as DispatchTaskBody
  if (!body.projectId || !body.title?.trim() || !body.prompt?.trim()) {
    res.status(400).json({ error: 'projectId, title, and prompt are required' })
    return
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, body.projectId), isNull(projects.deletedAt)))
    .limit(1)
  if (!project) { res.status(404).json({ error: 'Project not found' }); return }

  const [task] = await db.insert(tasks).values({
    projectId: body.projectId,
    title: body.title.trim(),
    prompt: body.prompt.trim(),
    status: 'queued',
  }).returning()

  // Enqueue for daemon pickup
  const queue = getTaskQueue()
  await queue.add('run-task', {
    taskId: task.id,
    projectId: project.id,
    localPath: project.localPath,
    prompt: task.prompt,
    websearchEnabled: project.websearchEnabled,
  }, {
    jobId: task.id,
    removeOnComplete: false,
    removeOnFail: false,
  })

  // Broadcast to project room
  getIO().to(`project:${body.projectId}`).emit('task.queued', { task })
  // Update project last_active_at
  await db.update(projects).set({ lastActiveAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, body.projectId))

  res.status(201).json(task)
})

router.get('/:id', requireAuth, async (req, res) => {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, req.params.id)).limit(1)
  if (!task) { res.status(404).json({ error: 'Not found' }); return }
  res.json(task)
})

// Cancel a running task (operator or agent self-cancel)
router.post('/:id/cancel', requireAuth, async (req, res) => {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, req.params.id)).limit(1)
  if (!task) { res.status(404).json({ error: 'Not found' }); return }
  if (!['queued', 'in_progress'].includes(task.status)) {
    res.status(409).json({ error: 'Task is not cancellable' }); return
  }

  // Signal daemon via Redis pub/sub
  const { getRedis } = await import('../services/redis.js')
  await getRedis().publish(`tasks:${task.id}:cancel`, '1')

  // If queued (not yet picked up), mark cancelled directly
  if (task.status === 'queued') {
    const [updated] = await db
      .update(tasks)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(eq(tasks.id, task.id))
      .returning()
    getIO().to(`project:${task.projectId}`).emit('task.cancelled', { taskId: task.id })
    res.json(updated)
  } else {
    res.json({ ok: true, message: 'Cancel signal sent to daemon' })
  }
})

// Daemon callback: update task status + streaming output
router.patch('/:id/status', requireDaemonToken, async (req, res) => {
  const body = req.body as TaskStatusUpdateBody
  const [task] = await db.select().from(tasks).where(eq(tasks.id, req.params.id)).limit(1)
  if (!task) { res.status(404).json({ error: 'Not found' }); return }

  const updates: Partial<typeof task> = {}
  if (body.status) updates.status = body.status
  if (body.exitCode !== undefined) updates.exitCode = body.exitCode
  if (body.errorMessage !== undefined) updates.errorMessage = body.errorMessage
  if (body.outputSummary !== undefined) updates.outputSummary = body.outputSummary
  if (body.daemonSessionId !== undefined) updates.daemonSessionId = body.daemonSessionId
  if (body.startedAt !== undefined) updates.startedAt = new Date(body.startedAt)
  if (body.completedAt !== undefined) updates.completedAt = new Date(body.completedAt)
  if (body.transcript !== undefined) {
    const enc = new TextEncoder()
    const bytes = enc.encode(body.transcript).length
    const { TASK_TRANSCRIPT_MAX_BYTES } = await import('../config/models.js')
    if (bytes > TASK_TRANSCRIPT_MAX_BYTES) {
      updates.transcript = body.transcript.slice(0, TASK_TRANSCRIPT_MAX_BYTES)
      updates.truncated = true
    } else {
      updates.transcript = body.transcript
    }
  }

  const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, task.id)).returning()
  const io = getIO()

  if (body.status === 'in_progress') {
    io.to(`project:${task.projectId}`).emit('task.started', { taskId: task.id, startedAt: updated.startedAt?.toISOString() ?? '' })
  } else if (body.status === 'completed') {
    io.to(`project:${task.projectId}`).emit('task.completed', { taskId: task.id, exitCode: updated.exitCode ?? 0, summary: updated.outputSummary })
  } else if (body.status === 'failed') {
    io.to(`project:${task.projectId}`).emit('task.failed', { taskId: task.id, errorMessage: updated.errorMessage ?? '' })
  } else if (body.status === 'cancelled') {
    io.to(`project:${task.projectId}`).emit('task.cancelled', { taskId: task.id })
  }

  res.json(updated)
})

// Daemon callback: stream a chunk of task output
router.post('/:id/output', requireDaemonToken, async (req, res) => {
  const { stream, chunk } = req.body as { stream: 'stdout' | 'stderr'; chunk: string }
  const [task] = await db.select({ projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, req.params.id)).limit(1)
  if (!task) { res.status(404).json({ error: 'Not found' }); return }

  getIO()
    .to(`task:${req.params.id}`)
    .to(`project:${task.projectId}`)
    .emit('task.output', { taskId: req.params.id, stream, chunk })

  res.json({ ok: true })
})

export default router
