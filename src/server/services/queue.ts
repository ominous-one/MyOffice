import { Queue } from 'bullmq'
import { env } from '../config/env.js'

let taskQueue: Queue | null = null

export function getTaskQueue(): Queue {
  if (!taskQueue) {
    taskQueue = new Queue('tasks', {
      connection: {
        url: env.redisUrl,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    })
  }
  return taskQueue
}
