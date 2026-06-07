import { spawn } from 'child_process'
import Redis from 'ioredis'
import type { DaemonConfig, TaskJob } from './types.js'

const TASK_TRANSCRIPT_MAX_BYTES = 10 * 1024 * 1024 // 10MB

export async function runTask(
  job: TaskJob,
  config: DaemonConfig,
  redis: Redis
): Promise<void> {
  const { taskId, projectId, localPath, prompt, websearchEnabled } = job

  const sessionId = `daemon-${config.daemonId}-${Date.now()}`
  const authHeader = { Authorization: `Bearer ${config.hqApiKey}` }
  const baseUrl = config.hqUrl

  // Mark in_progress
  await patchTask(baseUrl, taskId, authHeader, {
    status: 'in_progress',
    daemonSessionId: sessionId,
    startedAt: new Date().toISOString(),
  })

  let transcript = ''
  let truncated = false

  // claude args — non-interactive, print mode
  const args = [
    '--print',
    '--dangerously-skip-permissions',
    websearchEnabled ? '--allowedTools' : '--disallowedTools',
    websearchEnabled ? 'Bash,Read,Write,Edit,WebSearch,WebFetch' : 'WebSearch,WebFetch',
    '--',
    prompt,
  ]

  const child = spawn('claude', args, {
    cwd: localPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    },
    windowsHide: true,
  })
  console.log(`[task-runner] spawned claude PID ${child.pid} for task ${taskId} in ${localPath}`)

  // Cancel listener
  const cancelSub = new Redis(config.redisUrl, { maxRetriesPerRequest: null })
  cancelSub.on('error', (err) => console.error('[task-runner] cancelSub error:', err.message))
  cancelSub.subscribe(`tasks:${taskId}:cancel`).catch(() => {})
  cancelSub.on('message', (_ch, msg) => {
    if (msg === '1') {
      child.kill('SIGTERM')
      setTimeout(() => { if (!child.killed) child.kill('SIGKILL') }, 10_000)
    }
  })

  // Timeout
  const timeout = setTimeout(() => {
    console.warn(`[task-runner] task ${taskId} timed out`)
    child.kill('SIGTERM')
    setTimeout(() => { if (!child.killed) child.kill('SIGKILL') }, 10_000)
  }, config.taskTimeoutMs)

  function onChunk(stream: 'stdout' | 'stderr', data: Buffer) {
    const chunk = data.toString('utf8')

    // Stream chunk to HQ
    fetch(`${baseUrl}/api/tasks/${taskId}/output`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ stream, chunk }),
    }).catch(() => {})

    // Accumulate transcript
    if (!truncated) {
      transcript += chunk
      if (Buffer.byteLength(transcript, 'utf8') > TASK_TRANSCRIPT_MAX_BYTES) {
        transcript = transcript.slice(0, TASK_TRANSCRIPT_MAX_BYTES)
        truncated = true
      }
    }
  }

  child.stdout.on('data', (d) => onChunk('stdout', d))
  child.stderr.on('data', (d) => onChunk('stderr', d))

  await new Promise<void>((resolve) => {
    child.on('error', async (err) => {
      clearTimeout(timeout)
      try { cancelSub.disconnect() } catch {}
      console.error(`[task-runner] spawn error for task ${taskId}:`, err.message)
      await patchTask(baseUrl, taskId, authHeader, {
        status: 'failed',
        errorMessage: `Spawn error: ${err.message}`,
        transcript,
        truncated,
        completedAt: new Date().toISOString(),
      }).catch((e) => console.error('[task-runner] failed to patch task after spawn error:', e))
      resolve()
    })

    child.on('exit', async (code, signal) => {
      clearTimeout(timeout)
      try { cancelSub.disconnect() } catch {}

      let status: string
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        status = 'cancelled'
      } else if (code === 0) {
        status = 'completed'
      } else {
        status = 'failed'
      }

      // Generate brief output summary (first 200 chars of stdout)
      const outputSummary = transcript.slice(0, 200).replace(/\n/g, ' ').trim() || null

      await patchTask(baseUrl, taskId, authHeader, {
        status,
        exitCode: code ?? undefined,
        errorMessage: status === 'failed' ? `Process exited with code ${code}` : undefined,
        outputSummary,
        transcript,
        truncated,
        completedAt: new Date().toISOString(),
      }).catch((err) => console.error('[task-runner] failed to patch task:', err))

      resolve()
    })
  })
}

async function patchTask(
  baseUrl: string,
  taskId: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ taskId, ...body }),
  })
  if (!res.ok) {
    console.error(`[task-runner] PATCH /tasks/${taskId}/status returned ${res.status}`)
  }
}
