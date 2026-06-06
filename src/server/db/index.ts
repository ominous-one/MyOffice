import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '../config/env.js'
import * as schema from './schema.js'

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.isProduction ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
})

export const db = drizzle(pool, { schema })
export type DB = typeof db
