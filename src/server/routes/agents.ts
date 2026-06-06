import { Router } from 'express'
import { createHash } from 'crypto'
import { db } from '../db/index.js'
import { agentDefinitions } from '../db/schema.js'
import { eq, isNull } from 'drizzle-orm'
import { requireDaemonToken } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'
import type { AgentSyncBody } from '../../shared/types.js'

const router = Router()

router.get('/', requireAuth, async (_req, res) => {
  const defs = await db
    .select()
    .from(agentDefinitions)
    .where(isNull(agentDefinitions.deletedAt))
  res.json(defs)
})

// Daemon syncs an agent definition file
router.post('/sync', requireDaemonToken, async (req, res) => {
  const body = req.body as AgentSyncBody
  if (!body.filename || !body.name || !body.persona || !body.contentHash) {
    res.status(400).json({ error: 'filename, name, persona, contentHash required' })
    return
  }

  const [existing] = await db
    .select()
    .from(agentDefinitions)
    .where(eq(agentDefinitions.filename, body.filename))
    .limit(1)

  if (existing?.contentHash === body.contentHash && !existing.deletedAt) {
    res.json({ ok: true, changed: false })
    return
  }

  // Upsert: insert or update on filename conflict
  const values = {
    filename: body.filename,
    name: body.name,
    tier: (body.tier ?? 'director') as 'jarvis' | 'ceo' | 'director',
    modelOverride: body.modelOverride ?? null,
    persona: body.persona,
    rawContent: body.rawContent,
    sourcePath: body.sourcePath,
    contentHash: body.contentHash,
    deletedAt: null as Date | null,
  }

  const [existing2] = await db
    .select({ id: agentDefinitions.id })
    .from(agentDefinitions)
    .where(eq(agentDefinitions.filename, body.filename))
    .limit(1)

  let def
  if (existing2) {
    ;[def] = await db
      .update(agentDefinitions)
      .set({ ...values, syncedAt: new Date() })
      .where(eq(agentDefinitions.id, existing2.id))
      .returning()
  } else {
    ;[def] = await db.insert(agentDefinitions).values(values).returning()
  }

  res.json({ ok: true, changed: true, agent: def })
})

// Daemon signals that an agent file was deleted
router.delete('/sync/:filename', requireDaemonToken, async (req, res) => {
  await db
    .update(agentDefinitions)
    .set({ deletedAt: new Date() })
    .where(eq(agentDefinitions.filename, req.params.filename))
  res.json({ ok: true })
})

export default router
