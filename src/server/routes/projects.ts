import { Router } from 'express'
import { db } from '../db/index.js'
import { projects, activityFeedItems, checkpointSaves, conversationMessages, tasks } from '../db/schema.js'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { env } from '../config/env.js'
import type { CreateProjectBody, UpdateProjectBody } from '../../shared/types.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (_req, res) => {
  const rows = await db
    .select()
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(desc(projects.lastActiveAt))
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, req.params.id), isNull(projects.deletedAt)))
    .limit(1)
  if (!project) { res.status(404).json({ error: 'Not found' }); return }
  res.json(project)
})

router.post('/', async (req, res) => {
  const body = req.body as CreateProjectBody
  if (!body.name?.trim() || !body.localPath?.trim()) {
    res.status(400).json({ error: 'name and localPath are required' })
    return
  }

  const repoUrl = body.repoUrl?.trim() || null
  let githubOwner: string | null = null
  let githubRepo: string | null = null
  if (repoUrl) {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (match) { githubOwner = match[1]; githubRepo = match[2] }
  }

  const [project] = await db.insert(projects).values({
    name: body.name.trim(),
    localPath: body.localPath.trim(),
    repoUrl,
    githubOwner,
    githubRepo,
    renderServiceId: body.renderServiceId?.trim() || null,
    websearchEnabled: body.websearchEnabled ?? true,
  }).returning()

  res.status(201).json(project)
})

router.patch('/:id', async (req, res) => {
  const body = req.body as UpdateProjectBody
  const [existing] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, req.params.id), isNull(projects.deletedAt)))
    .limit(1)
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const updates: Partial<typeof existing> = { updatedAt: new Date() }
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.status !== undefined) updates.status = body.status
  if (body.websearchEnabled !== undefined) updates.websearchEnabled = body.websearchEnabled
  if (body.renderServiceId !== undefined) updates.renderServiceId = body.renderServiceId?.trim() || null
  if (body.repoUrl !== undefined) {
    updates.repoUrl = body.repoUrl?.trim() || null
    const match = updates.repoUrl?.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
    updates.githubOwner = match?.[1] ?? null
    updates.githubRepo = match?.[2] ?? null
  }

  const [updated] = await db
    .update(projects)
    .set(updates)
    .where(eq(projects.id, req.params.id))
    .returning()
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const [existing] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, req.params.id), isNull(projects.deletedAt)))
    .limit(1)
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, req.params.id))
  res.json({ ok: true })
})

router.get('/:id/activity', async (req, res) => {
  const items = await db
    .select()
    .from(activityFeedItems)
    .where(eq(activityFeedItems.projectId, req.params.id))
    .orderBy(desc(activityFeedItems.occurredAt))
    .limit(50)
  res.json(items)
})

router.post('/:id/sync-github', async (req, res) => {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, req.params.id), isNull(projects.deletedAt)))
    .limit(1)
  if (!project) { res.status(404).json({ error: 'Not found' }); return }
  if (!project.githubOwner || !project.githubRepo) {
    res.status(400).json({ error: 'Project has no GitHub repo configured' })
    return
  }
  if (!env.githubToken) {
    res.status(503).json({ error: 'GITHUB_TOKEN not configured on server' })
    return
  }

  const apiUrl = `https://api.github.com/repos/${project.githubOwner}/${project.githubRepo}/commits?per_page=15`
  const ghRes = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${env.githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!ghRes.ok) {
    const reachable = ghRes.status !== 404 && ghRes.status !== 403
    await db.update(projects).set({
      githubReachable: reachable,
      lastGithubSyncAt: new Date(),
      lastGithubStatus: 'failed',
      updatedAt: new Date(),
    }).where(eq(projects.id, project.id))
    res.status(502).json({ error: `GitHub API returned ${ghRes.status}` })
    return
  }

  type GhCommit = {
    sha: string
    commit: { message: string; author: { name: string; date: string } }
    html_url: string
    author: { login: string } | null
  }
  const commits = await ghRes.json() as GhCommit[]

  for (const c of commits) {
    const summary = `${c.commit.message.split('\n')[0].slice(0, 120)} — ${c.author?.login ?? c.commit.author.name}`
    await db
      .insert(activityFeedItems)
      .values({
        projectId: project.id,
        source: 'github',
        eventType: 'push',
        externalId: c.sha,
        summary,
        url: c.html_url,
        metadata: { sha: c.sha, author: c.author?.login ?? c.commit.author.name },
        occurredAt: new Date(c.commit.author.date),
      })
      .onConflictDoNothing()
  }

  await db.update(projects).set({
    githubReachable: true,
    lastGithubSyncAt: new Date(),
    lastGithubStatus: 'success',
    updatedAt: new Date(),
  }).where(eq(projects.id, project.id))

  res.json({ synced: commits.length })
})

router.get('/:id/checkpoints', async (req, res) => {
  const items = await db
    .select()
    .from(checkpointSaves)
    .where(eq(checkpointSaves.projectId, req.params.id))
    .orderBy(desc(checkpointSaves.createdAt))
  res.json(items)
})

router.post('/:id/checkpoints', async (req, res) => {
  const { label, gitSha, notes } = req.body as { label: string; gitSha: string; notes?: string }
  if (!label?.trim() || !gitSha?.trim()) {
    res.status(400).json({ error: 'label and gitSha are required' })
    return
  }
  const [checkpoint] = await db.insert(checkpointSaves).values({
    projectId: req.params.id,
    label: label.trim(),
    gitSha: gitSha.trim(),
    notes: notes?.trim() || null,
  }).returning()
  res.status(201).json(checkpoint)
})

router.get('/:id/messages', async (req, res) => {
  const msgs = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.projectId, req.params.id))
    .orderBy(conversationMessages.createdAt)
    .limit(200)
  res.json(msgs)
})

router.get('/:id/tasks', async (req, res) => {
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, req.params.id))
    .orderBy(desc(tasks.createdAt))
    .limit(50)
  res.json(rows)
})

export default router
