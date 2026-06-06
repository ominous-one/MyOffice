import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createHash, randomUUID } from 'crypto'
import rateLimit from 'express-rate-limit'
import { db } from '../db/index.js'
import { sessions } from '../db/schema.js'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/auth.js'

const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60 // 30 days

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
})

const router = Router()

router.post('/login', loginLimiter, async (req, res) => {
  const { password } = req.body as { password?: string }
  if (!password) {
    res.status(400).json({ error: 'Password required' })
    return
  }

  const valid = await bcrypt.compare(password, env.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid password' })
    return
  }

  const sessionId = randomUUID()
  const token = jwt.sign(
    { sessionId },
    env.jwtSecret,
    { expiresIn: SESSION_DURATION_SECONDS }
  )
  const tokenHash = createHash('sha256').update(token.split('.')[2]).digest('hex')

  try {
    await db.insert(sessions).values({
      id: sessionId,
      tokenHash,
      deviceLabel: detectDevice(req.headers['user-agent']),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip ?? null,
      expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
    })
  } catch (err) {
    console.error('[auth] session insert failed:', err)
    res.status(500).json({ error: 'Login failed' })
    return
  }

  res.cookie('cowork_session', token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS * 1000,
  })

  res.json({ ok: true })
})

router.post('/logout', requireAuth, async (req, res) => {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, req.sessionId!))
  res.clearCookie('cowork_session', { path: '/' })
  res.json({ ok: true })
})

router.get('/sessions', requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(sessions)
    .where(
      and(isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))
    )
  res.json(rows.map((s) => ({
    id: s.id,
    deviceLabel: s.deviceLabel,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    expiresAt: s.expiresAt,
    isCurrent: s.id === req.sessionId,
  })))
})

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, req.params.id))
  res.json({ ok: true })
})

function detectDevice(ua?: string): string {
  if (!ua) return 'Unknown'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac/i.test(ua)) return 'Mac'
  return 'Browser'
}

export default router
