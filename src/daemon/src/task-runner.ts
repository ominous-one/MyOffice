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

  // Cancel listener (shared across attempts)
  const cancelSub = new Redis(config.redisUrl, { maxRetriesPerRequest: null })
  cancelSub.on('error', (err) => console.error('[task-runner] cancelSub error:', err.message))
  cancelSub.subscribe(`tasks:${taskId}:cancel`).catch(() => {})

  let cancelled = false
  let currentChild: ReturnType<typeof spawn> | null = null
  cancelSub.on('message', (_ch, msg) => {
    if (msg === '1') {
      cancelled = true
      if (currentChild && !currentChild.killed) {
        currentChild.kill('SIGTERM')
        setTimeout(() => { if (currentChild && !currentChild.killed) currentChild.kill('SIGKILL') }, 10_000)
      }
    }
  })

  const result = await attempt({ baseUrl, taskId, authHeader, localPath, prompt, websearchEnabled, config, cancelSub: { setCurrent: (c) => { currentChild = c } } })

  // Websearch-before-giveup: retry once with websearch if first attempt failed and wasn't cancelled/timeout
  if (result.status === 'failed' && !websearchEnabled && !cancelled && !result.timedOut) {
    console.log(`[task-runner] task ${taskId} failed — retrying with websearch enabled`)
    const retry = await attempt({
      baseUrl, taskId, authHeader, localPath,
      prompt: `[Retry with web search]\n${prompt}`,
      websearchEnabled: true,
      config,
      cancelSub: { setCurrent: (c) => { currentChild = c } },
      transcriptPrefix: `[First attempt failed — retrying with web search]\n${result.transcript}\n\n[Retry attempt]\n`,
    })
    try { cancelSub.disconnect() } catch {}
    await patchTask(baseUrl, taskId, authHeader, {
      status: retry.status,
      exitCode: retry.exitCode ?? undefined,
      errorMessage: retry.status === 'failed' ? `Process exited with code ${retry.exitCode}` : undefined,
      outputSummary: retry.outputSummary,
      transcript: retry.transcript,
      truncated: retry.truncated,
      completedAt: new Date().toISOString(),
    }).catch((e) => console.error('[task-runner] failed to patch task after retry:', e))
    return
  }

  try { cancelSub.disconnect() } catch {}
  await patchTask(baseUrl, taskId, authHeader, {
    status: result.status,
    exitCode: result.exitCode ?? undefined,
    errorMessage: result.status === 'failed' ? `Spawn error: ${result.errorMessage}` : undefined,
    outputSummary: result.outputSummary,
    transcript: result.transcript,
    truncated: result.truncated,
    completedAt: new Date().toISOString(),
  }).catch((e) => console.error('[task-runner] failed to patch task:', e))
}

interface AttemptOptions {
  baseUrl: string
  taskId: string
  authHeader: Record<string, string>
  localPath: string
  prompt: string
  websearchEnabled: boolean
  config: DaemonConfig
  cancelSub: { setCurrent: (c: ReturnType<typeof spawn>) => void }
  transcriptPrefix?: string
}

interface AttemptResult {
  status: 'completed' | 'failed' | 'cancelled'
  exitCode: number | null
  errorMessage?: string
  outputSummary: string | null
  transcript: string
  truncated: boolean
  timedOut: boolean
}

async function attempt(opts: AttemptOptions): Promise<AttemptResult> {
  const { baseUrl, taskId, authHeader, localPath, prompt, websearchEnabled, config, cancelSub, transcriptPrefix = '' } = opts

  let transcript = transcriptPrefix
  let truncated = false
  let timedOut = false

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
    env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
    windowsHide: true,
  })
  cancelSub.setCurrent(child)
  console.log(`[task-runner] spawned claude PID ${child.pid} for task ${taskId} in ${localPath}${websearchEnabled ? ' (websearch)' : ''}`)

  const timeout = setTimeout(() => {
    timedOut = true
    console.warn(`[task-runner] task ${taskId} timed out`)
    child.kill('SIGTERM')
    setTimeout(() => { if (!child.killed) child.kill('SIGKILL') }, 10_000)
  }, config.taskTimeoutMs)

  function onChunk(stream: 'stdout' | 'stderr', data: Buffer) {
    const chunk = data.toString('utf8')
    fetch(`${baseUrl}/api/tasks/${taskId}/output`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ stream, chunk }),
    }).catch(() => {})
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

  return new Promise<AttemptResult>((resolve) => {
    child.on('error', (err) => {
      clearTimeout(timeout)
      resolve({
        status: 'failed',
        exitCode: null,
        errorMessage: err.message,
        outputSummary: null,
        transcript,
        truncated,
        timedOut,
      })
    })

    child.on('exit', (code, signal) => {
      clearTimeout(timeout)
      let status: 'completed' | 'failed' | 'cancelled'
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        status = 'cancelled'
      } else if (code === 0) {
        status = 'completed'
      } else {
        status = 'failed'
      }
      const outputSummary = transcript.replace(transcriptPrefix, '').slice(0, 200).replace(/\n/g, ' ').trim() || null
      resolve({ status, exitCode: code, outputSummary, transcript, truncated, timedOut })
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
