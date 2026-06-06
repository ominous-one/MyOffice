import { Redis } from 'ioredis'
import { env } from '../config/env.js'

let client: Redis | null = null

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    })
    client.on('error', (err: Error) => {
      console.error('[redis] connection error:', err.message)
    })
  }
  return client
}
