import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { briefingGenerations, tasks, projects } from '../db/schema.js'
import { eq, desc, gte, and, isNull } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { env } from '../config/env.js'
import { BRIEFING_GAP_HOURS } from '../config/models.js'

const router = Router()
const client = new Anthropic({ apiKey: env.anthropicApiKey })

// GET /api/briefing/today — return today's briefing if it exists
router.get('/today', requireAuth, async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const [briefing] = await db
      .select()
      .from(briefingGenerations)
      .where(eq(briefingGenerations.briefingDate, today))
      .orderBy(desc(briefingGenerations.triggeredAt))
      .limit(1)
    res.json(briefing ?? null)
  } catch (err) {
    console.error('[briefing] GET /today error:', err)
    res.status(500).json({ error: 'Failed to fetch briefing' })
  }
})

// POST /api/briefing/generate — generate (or return cached) briefing for today
router.post('/generate', requireAuth, async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10)

    // Return cached if exists
    const [existing] = await db
      .select()
      .from(briefingGenerations)
      .where(and(
        eq(briefingGenerations.briefingDate, today),
        eq(briefingGenerations.triggerReason, 'session_entry_gap'),
      ))
      .limit(1)
    if (existing) {
      res.json(existing)
      return
    }

    // Gather context: recent completed tasks across all active projects
    const since = new Date(Date.now() - BRIEFING_GAP_HOURS * 3600_000)
    const recentTasks = await db
      .select({ title: tasks.title, status: tasks.status, completedAt: tasks.completedAt, projectName: projects.name })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        gte(tasks.completedAt, since),
        isNull(projects.deletedAt),
      ))
      .orderBy(desc(tasks.completedAt))
      .limit(20)

    const activeProjects = await db
      .select({ name: projects.name, status: projects.status })
      .from(projects)
      .where(and(eq(projects.status, 'active'), isNull(projects.deletedAt)))

    const completedCount = recentTasks.filter((t) => t.status === 'completed').length
    const failedCount = recentTasks.filter((t) => t.status === 'failed').length

    const contextLines = [
      `Active projects: ${activeProjects.map((p) => p.name).join(', ') || 'none'}`,
      `Tasks completed in last ${BRIEFING_GAP_HOURS}h: ${completedCount}`,
      failedCount > 0 ? `Tasks failed: ${failedCount}` : null,
      recentTasks.length > 0
        ? `Recent work:\n${recentTasks.map((t) => `  - [${t.status}] ${t.projectName}: ${t.title}`).join('\n')}`
        : 'No tasks run recently.',
    ].filter(Boolean).join('\n')

    const prompt = `You are Jarvis, the ambient CEO of MyOffice HQ. Greet the operator (Riley) with a brief, punchy morning briefing in 2-3 sentences. Be specific about what got done. No filler, no bullet points — write it like you're speaking. End with one sharp observation or recommendation.

Context:
${contextLines}

Write only the greeting. No preamble.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = (response.content[0] as { type: string; text: string }).text.trim()
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens

    const [briefing] = await db.insert(briefingGenerations).values({
      briefingDate: today,
      triggerReason: 'session_entry_gap',
      content,
      model: 'claude-sonnet-4-6',
      inputTokens,
      outputTokens,
    }).returning()

    res.json(briefing)
  } catch (err) {
    console.error('[briefing] POST /generate error:', err)
    res.status(500).json({ error: 'Failed to generate briefing' })
  }
})

// POST /api/briefing/:id/dismiss
router.post('/:id/dismiss', requireAuth, async (req, res) => {
  try {
    await db
      .update(briefingGenerations)
      .set({ dismissedAt: new Date() })
      .where(eq(briefingGenerations.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[briefing] dismiss error:', err)
    res.status(500).json({ error: 'Failed to dismiss' })
  }
})

export default router
