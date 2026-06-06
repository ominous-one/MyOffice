import 'dotenv/config'

function require(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  databaseUrl: require('DATABASE_URL'),
  redisUrl: require('REDIS_URL'),
  anthropicApiKey: require('ANTHROPIC_API_KEY'),
  githubToken: optional('GITHUB_TOKEN'),
  renderApiKey: optional('RENDER_API_KEY'),
  passwordHash: require('COWORK_PASSWORD_HASH'),
  jwtSecret: require('COWORK_JWT_SECRET'),
  daemonToken: require('COWORK_DAEMON_TOKEN'),
  hqPublicUrl: optional('HQ_PUBLIC_URL', 'http://localhost:3000'),
  logLevel: optional('LOG_LEVEL', 'info'),
  isProduction: optional('NODE_ENV', 'development') === 'production',
} as const
