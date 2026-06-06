import Anthropic from '@anthropic-ai/sdk'
import { env } from '../config/env.js'
import { db } from '../db/index.js'
import { conversationMessages } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { MODEL_BY_AGENT_TIER, MAX_HISTORY_MESSAGES, MAX_TOKENS_PER_RESPONSE } from '../config/models.js'
import type { AgentTierKey } from '../config/models.js'
import type { Socket } from 'socket.io'
import type { ConversationMessage } from '../../shared/types.js'

const client = new Anthropic({ apiKey: env.anthropicApiKey })

interface StreamChatOptions {
  projectId: string | null
  agentId: string
  tierKey: AgentTierKey
  userContent: string
  socket: Socket
  messageId: string
}

export async function streamChat(opts: StreamChatOptions): Promise<ConversationMessage> {
  const { projectId, agentId, tierKey, userContent, socket, messageId } = opts
  const model = MODEL_BY_AGENT_TIER[tierKey]

  // Persist user message
  const [userMsg] = await db.insert(conversationMessages).values({
    scope: projectId ? 'project' : 'global',
    projectId: projectId ?? null,
    agentId,
    role: 'user',
    content: userContent,
    model: null,
    inputTokens: null,
    outputTokens: null,
  }).returning()

  // Reconstruct history from DB
  const history = await db
    .select()
    .from(conversationMessages)
    .where(projectId
      ? eq(conversationMessages.projectId, projectId)
      : eq(conversationMessages.scope, 'global')
    )
    .orderBy(conversationMessages.createdAt)
    .limit(MAX_HISTORY_MESSAGES)

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))

  // Stream from Anthropic
  const room = projectId ? `project:${projectId}` : 'global'
  let accumulated = ''

  const stream = client.messages.stream({
    model,
    system: `You are ${agentId}, an expert AI agent in the MyOffice HQ system.`,
    messages,
    max_tokens: MAX_TOKENS_PER_RESPONSE,
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      accumulated += event.delta.text
      socket.to(room).emit('message.token', { id: messageId, delta: event.delta.text })
      socket.emit('message.token', { id: messageId, delta: event.delta.text })
    }
  }

  const final = await stream.finalMessage()

  // Persist agent message
  const [agentMsg] = await db.insert(conversationMessages).values({
    scope: projectId ? 'project' : 'global',
    projectId: projectId ?? null,
    agentId,
    role: 'agent',
    content: accumulated,
    model,
    inputTokens: final.usage.input_tokens,
    outputTokens: final.usage.output_tokens,
  }).returning()

  const agentMsgOut = {
    ...agentMsg,
    createdAt: agentMsg.createdAt.toISOString(),
    projectId: agentMsg.projectId ?? null,
    taskId: agentMsg.taskId ?? null,
  }

  socket.to(room).emit('message.complete', { message: agentMsgOut })
  socket.emit('message.complete', { message: agentMsgOut })

  return agentMsgOut as ConversationMessage
}
