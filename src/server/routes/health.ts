import { Router } from 'express'
import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'
import { getRedis } from '../services/redis.js'

const router = Router()

router.get('/', async (_req, res) => {
  const checks: Record<string, string> = {}

  try {
    await db.execute(sql`SELECT 1`)
    checks.postgres = 'ok'
  } catch {
    checks.postgres = 'error'
  }

  try {
    await getRedis().ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  const healthy = Object.values(checks).every((v) => v === 'ok')
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

export default router
