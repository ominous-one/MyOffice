import type { Server as HTTPServer } from 'http'
import { Server, type Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'
import { db } from '../db/index.js'
import { sessions } from '../db/schema.js'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { env } from '../config/env.js'
import { streamChat } from '../services/anthropic.js'
import { getTaskQueue } from '../services/queue.js'
import { getRedis } from '../services/redis.js'
import type { AuthPayload } from '../middleware/auth.js'
import { v4 as uuidv4 } from 'uuid'

let io: Server | null = null

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}

export function initSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.isProduction ? env.hqPublicUrl : '*', credentials: true },
    path: '/socket.io',
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.headers.cookie
      ?.split(';')
      .find((c) => c.trim().startsWith('cowork_session='))
      ?.split('=')[1]

    if (!token) { next(new Error('Not authenticated')); return }

    let payload: AuthPayload
    try {
      payload = jwt.verify(token, env.jwtSecret) as AuthPayload
    } catch {
      next(new Error('Invalid session')); return
    }

    const tokenHash = createHash('sha256').update(token.split('.')[2]).digest('hex')
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.id, payload.sessionId),
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ))
      .limit(1)

    if (!session) { next(new Error('Session expired')); return }
    socket.data.sessionId = session.id
    next()
  })

  io.on('connection', (socket: Socket) => {
    socket.join('global')

    socket.on('project.open', ({ projectId }) => {
      socket.join(`project:${projectId}`)
    })

    socket.on('project.close', ({ projectId }) => {
      socket.leave(`project:${projectId}`)
    })

    socket.on('chat.send', async ({ projectId, content }) => {
      try {
        const messageId = uuidv4()
        await streamChat({
          projectId: projectId ?? null,
          agentId: projectId ? 'project-ceo' : 'jarvis',
          tierKey: projectId ? 'project_ceo' : 'jarvis_ambient',
          userContent: content,
          socket,
          messageId,
        })
      } catch (err) {
        console.error('[socket] chat.send error:', err)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    socket.on('task.dispatch', async ({ projectId, prompt, title }) => {
      try {
        // Delegate to REST-equivalent logic via direct import
        const { db } = await import('../db/index.js')
        const { tasks: tasksSchema, projects: projectsSchema } = await import('../db/schema.js')
        const { eq, and, isNull } = await import('drizzle-orm')
        const { getIO } = await import('./index.js')

        const [project] = await db
          .select()
          .from(projectsSchema)
          .where(and(eq(projectsSchema.id, projectId), isNull(projectsSchema.deletedAt)))
          .limit(1)
        if (!project) { socket.emit('error', { message: 'Project not found' }); return }

        const [task] = await db.insert(tasksSchema).values({
          projectId,
          title: title.trim(),
          prompt: prompt.trim(),
          status: 'queued',
        }).returning()

        await getTaskQueue().add('run-task', {
          taskId: task.id,
          projectId: project.id,
          localPath: project.localPath,
          prompt: task.prompt,
          websearchEnabled: project.websearchEnabled,
        }, { jobId: task.id, removeOnComplete: false, removeOnFail: false })

        await db.update(projectsSchema).set({ lastActiveAt: new Date(), updatedAt: new Date() }).where(eq(projectsSchema.id, projectId))
        getIO().to(`project:${projectId}`).emit('task.queued', { task })
      } catch (err) {
        console.error('[socket] task.dispatch error:', err)
        socket.emit('error', { message: 'Failed to dispatch task' })
      }
    })

    socket.on('task.cancel', async ({ taskId }) => {
      await getRedis().publish(`tasks:${taskId}:cancel`, '1')
    })

    socket.on('checkpoint.create', async ({ projectId, label, notes }) => {
      socket.emit('error', { message: 'Use REST POST /api/projects/:id/checkpoints — gitSha required' })
    })
  })

  return io
}
