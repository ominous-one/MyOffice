import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { DaemonConfig } from './types.js'

interface AgentFrontmatter {
  name?: string
  tier?: 'jarvis' | 'ceo' | 'director'
  model?: string
}

function parseFrontmatter(content: string): { meta: AgentFrontmatter; body: string } {
  const fm: AgentFrontmatter = {}
  if (!content.startsWith('---')) return { meta: fm, body: content }

  const end = content.indexOf('\n---', 3)
  if (end === -1) return { meta: fm, body: content }

  const block = content.slice(4, end)
  for (const line of block.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (!match) continue
    const [, key, value] = match
    const v = value.trim().replace(/^["']|["']$/g, '')
    if (key === 'name') fm.name = v
    else if (key === 'tier') fm.tier = v as AgentFrontmatter['tier']
    else if (key === 'model') fm.model = v
  }

  return { meta: fm, body: content.slice(end + 4).trim() }
}

export async function syncAgents(config: DaemonConfig): Promise<void> {
  const { agentsDir, hqUrl, hqApiKey } = config

  if (!fs.existsSync(agentsDir)) {
    console.log(`[agent-sync] agents dir not found: ${agentsDir}`)
    return
  }

  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'))
  console.log(`[agent-sync] syncing ${files.length} agent files`)

  for (const filename of files) {
    const filePath = path.join(agentsDir, filename)
    const rawContent = fs.readFileSync(filePath, 'utf-8')
    const contentHash = crypto.createHash('sha256').update(rawContent).digest('hex')
    const { meta, body } = parseFrontmatter(rawContent)

    const agentName = meta.name ?? filename.replace('.md', '')

    try {
      const res = await fetch(`${hqUrl}/api/agents/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hqApiKey}`,
        },
        body: JSON.stringify({
          filename,
          name: agentName,
          tier: meta.tier ?? 'director',
          modelOverride: meta.model ?? null,
          persona: body,
          rawContent,
          sourcePath: filePath,
          contentHash,
        }),
      })
      if (!res.ok) {
        console.error(`[agent-sync] failed to sync ${filename}: ${res.status}`)
      }
    } catch (err) {
      console.error(`[agent-sync] error syncing ${filename}:`, (err as Error).message)
    }
  }
}

export function watchAgents(config: DaemonConfig): void {
  const { agentsDir } = config
  if (!fs.existsSync(agentsDir)) return

  fs.watch(agentsDir, { persistent: false }, (event, filename) => {
    if (!filename?.endsWith('.md')) return
    // Debounce 500ms
    setTimeout(() => syncAgents(config), 500)
  })
  console.log(`[agent-sync] watching ${agentsDir}`)
}
