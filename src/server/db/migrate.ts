import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { env } from '../config/env.js'

async function runMigrations() {
  console.log('Running database migrations...')
  const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: env.isProduction ? { rejectUnauthorized: false } : false,
  })
  const db = drizzle(pool)
  // In production (compiled): migrations are in dist/server/db/migrations
  // In dev (tsx): migrations are in src/server/db/migrations
  const migrationsFolder = process.env.NODE_ENV === 'production'
    ? 'dist/server/db/migrations'
    : 'src/server/db/migrations'
  await migrate(db, { migrationsFolder })
  await pool.end()
  console.log('Migrations complete.')
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
