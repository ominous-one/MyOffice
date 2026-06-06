import { Router } from 'express'
import { isNotNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { conversationMessages, briefingGenerations } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Cost per million tokens (USD) by model family prefix
const COST_PER_M: Array<{ prefix: string; input: number; output: number }> = [
  { prefix: 'claude-opus', input: 15, output: 75 },
  { prefix: 'claude-sonnet', input: 3, output: 15 },
  { prefix: 'claude-haiku', input: 0.25, output: 1.25 },
]

function rateForModel(model: string | null) {
  if (!model) return { input: 0, output: 0 }
  return COST_PER_M.find((r) => model.startsWith(r.prefix)) ?? { input: 3, output: 15 }
}

type CostItem = { model: string | null; input: number; output: number; at: Date }

function aggregate(items: CostItem[]) {
  let inputTokens = 0
  let outputTokens = 0
  let usd = 0
  for (const item of items) {
    inputTokens += item.input
    outputTokens += item.output
    const rate = rateForModel(item.model)
    usd += (item.input * rate.input + item.output * rate.output) / 1_000_000
  }
  return { inputTokens, outputTokens, usdEstimate: Math.round(usd * 10_000) / 10_000 }
}

router.get('/cost', requireAuth, async (_req, res) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [msgs, briefs] = await Promise.all([
    db.select({
      model: conversationMessages.model,
      inputTokens: conversationMessages.inputTokens,
      outputTokens: conversationMessages.outputTokens,
      createdAt: conversationMessages.createdAt,
    }).from(conversationMessages).where(isNotNull(conversationMessages.model)),

    db.select({
      model: briefingGenerations.model,
      inputTokens: briefingGenerations.inputTokens,
      outputTokens: briefingGenerations.outputTokens,
      triggeredAt: briefingGenerations.triggeredAt,
    }).from(briefingGenerations),
  ])

  const items: CostItem[] = [
    ...msgs.map((m) => ({ model: m.model, input: m.inputTokens ?? 0, output: m.outputTokens ?? 0, at: m.createdAt })),
    ...briefs.map((b) => ({ model: b.model, input: b.inputTokens, output: b.outputTokens, at: b.triggeredAt })),
  ]

  res.json({
    allTime: aggregate(items),
    last30d: aggregate(items.filter((i) => i.at >= last30d)),
    last7d: aggregate(items.filter((i) => i.at >= last7d)),
    today: aggregate(items.filter((i) => i.at >= today)),
    ratesPerMTokens: COST_PER_M,
  })
})

export default router
