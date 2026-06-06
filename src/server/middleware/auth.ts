import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'
import { db } from '../db/index.js'
import { sessions } from '../db/schema.js'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { env } from '../config/env.js'

export interface AuthPayload {
  sessionId: string
  iat: number
  exp: number
}

declare global {
  namespace Express {
    interface Request {
      sessionId?: string
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.cowork_session
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  let payload: AuthPayload
  try {
    payload = jwt.verify(token, env.jwtSecret) as AuthPayload
  } catch {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const tokenHash = createHash('sha256').update(token.split('.')[2]).digest('hex')
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, payload.sessionId),
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      )
    )
    .limit(1)

  if (!session) {
    res.status(401).json({ error: 'Session expired or revoked' })
    return
  }

  // Rolling expiry — refresh last_seen_at
  await db
    .update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessions.id, session.id))

  req.sessionId = session.id
  next()
}

export function requireDaemonToken(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== env.daemonToken) {
    res.status(401).json({ error: 'Invalid daemon token' })
    return
  }
  next()
}
