import {
  pgTable, pgEnum, uuid, text, boolean, integer, timestamp, date,
  bigserial, inet, jsonb, uniqueIndex, index, check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── enums ───────────────────────────────────────────────────────────────────

export const projectStatusEnum = pgEnum('project_status', ['active', 'paused', 'archived'])
export const taskStatusEnum = pgEnum('task_status', ['queued', 'in_progress', 'completed', 'cancelled', 'failed'])
export const messageRoleEnum = pgEnum('message_role', ['user', 'agent', 'system'])
export const messageScopeEnum = pgEnum('message_scope', ['project', 'global'])
export const activitySourceEnum = pgEnum('activity_source', ['github', 'render'])
export const fetchStatusEnum = pgEnum('fetch_status', ['success', 'stale', 'failed', 'rate_limited'])
export const agentTierEnum = pgEnum('agent_tier', ['jarvis', 'ceo', 'director'])

// ─── projects ────────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  localPath: text('local_path').notNull(),
  repoUrl: text('repo_url'),
  githubOwner: text('github_owner'),
  githubRepo: text('github_repo'),
  renderServiceId: text('render_service_id'),
  status: projectStatusEnum('status').notNull().default('active'),
  websearchEnabled: boolean('websearch_enabled').notNull().default(true),
  githubReachable: boolean('github_reachable').notNull().default(true),
  lastGithubSyncAt: timestamp('last_github_sync_at', { withTimezone: true }),
  lastGithubStatus: fetchStatusEnum('last_github_status'),
  lastRenderSyncAt: timestamp('last_render_sync_at', { withTimezone: true }),
  lastRenderStatus: fetchStatusEnum('last_render_status'),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  lastCheckinAt: timestamp('last_checkin_at', { withTimezone: true }),
  interviewDismissedAt: timestamp('interview_dismissed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_projects_status_active').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  index('idx_projects_last_active').on(t.lastActiveAt).where(sql`${t.deletedAt} IS NULL`),
])

// ─── tasks ───────────────────────────────────────────────────────────────────

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  status: taskStatusEnum('status').notNull().default('queued'),
  daemonSessionId: text('daemon_session_id'),
  exitCode: integer('exit_code'),
  errorMessage: text('error_message'),
  outputSummary: text('output_summary'),
  transcript: text('transcript'),
  truncated: boolean('truncated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => [
  index('idx_tasks_project_status').on(t.projectId, t.status),
  index('idx_tasks_project_created').on(t.projectId, t.createdAt),
  index('idx_tasks_active').on(t.status).where(
    sql`${t.status} IN ('queued', 'in_progress')`
  ),
])

// ─── conversation_messages ────────────────────────────────────────────────────

export const conversationMessages = pgTable('conversation_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  scope: messageScopeEnum('scope').notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'restrict' }),
  agentId: text('agent_id').notNull(),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_msgs_project_created').on(t.projectId, t.createdAt).where(
    sql`${t.scope} = 'project'`
  ),
  index('idx_msgs_global_created').on(t.createdAt).where(
    sql`${t.scope} = 'global'`
  ),
  index('idx_msgs_task').on(t.taskId).where(sql`${t.taskId} IS NOT NULL`),
  check('msg_scope_matches_project', sql`
    (${t.scope} = 'global' AND ${t.projectId} IS NULL) OR
    (${t.scope} = 'project' AND ${t.projectId} IS NOT NULL)
  `),
])

// ─── checkpoint_saves ─────────────────────────────────────────────────────────

export const checkpointSaves = pgTable('checkpoint_saves', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  gitSha: text('git_sha').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_checkpoints_project_created').on(t.projectId, t.createdAt),
])

// ─── activity_feed_items ─────────────────────────────────────────────────────

export const activityFeedItems = pgTable('activity_feed_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  source: activitySourceEnum('source').notNull(),
  eventType: text('event_type').notNull(),
  externalId: text('external_id').notNull(),
  summary: text('summary').notNull(),
  url: text('url'),
  metadata: jsonb('metadata'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_activity_unique').on(t.projectId, t.source, t.externalId),
  index('idx_activity_project_occurred').on(t.projectId, t.occurredAt),
  index('idx_activity_source').on(t.projectId, t.source, t.occurredAt),
])

// ─── interview_states ─────────────────────────────────────────────────────────

export const interviewStates = pgTable('interview_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  currentQuestionIndex: integer('current_question_index').notNull().default(0),
  answers: jsonb('answers').notNull().default(sql`'[]'::jsonb`),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

// ─── agent_definitions ────────────────────────────────────────────────────────

export const agentDefinitions = pgTable('agent_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: text('filename').notNull().unique(),
  name: text('name').notNull(),
  tier: agentTierEnum('tier').notNull().default('director'),
  modelOverride: text('model_override'),
  persona: text('persona').notNull(),
  rawContent: text('raw_content').notNull(),
  sourcePath: text('source_path').notNull(),
  contentHash: text('content_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_agent_defs_tier').on(t.tier).where(sql`${t.deletedAt} IS NULL`),
])

// ─── sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  deviceLabel: text('device_label'),
  userAgent: text('user_agent'),
  ipAddress: inet('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [
  index('idx_sessions_active').on(t.expiresAt).where(sql`${t.revokedAt} IS NULL`),
])

// ─── briefing_generations ─────────────────────────────────────────────────────

export const briefingGenerations = pgTable('briefing_generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  briefingDate: date('briefing_date').notNull(),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  triggerReason: text('trigger_reason').notNull(),
  content: text('content').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('idx_briefings_one_per_day').on(t.briefingDate).where(
    sql`${t.triggerReason} = 'session_entry_gap'`
  ),
])

// ─── daemon_heartbeats ────────────────────────────────────────────────────────

export const daemonHeartbeats = pgTable('daemon_heartbeats', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  daemonId: text('daemon_id').notNull(),
  hostName: text('host_name'),
  daemonVersion: text('daemon_version'),
  activeTaskId: uuid('active_task_id').references(() => tasks.id, { onDelete: 'set null' }),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_heartbeats_recent').on(t.daemonId, t.reportedAt),
])
