import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { createServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from './config/env.js'
import { initSocket } from './socket/index.js'
import authRouter from './routes/auth.js'
import projectsRouter from './routes/projects.js'
import tasksRouter from './routes/tasks.js'
import agentsRouter from './routes/agents.js'
import daemonRouter from './routes/daemon.js'
import healthRouter from './routes/health.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const httpServer = createServer(app)

app.set('trust proxy', 1)
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use(cors({
  origin: env.isProduction ? env.hqPublicUrl : true,
  credentials: true,
}))

// Initialize Socket.IO before routes (routes reference getIO())
initSocket(httpServer)

// API routes
app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/agents', agentsRouter)
app.use('/api/daemon', daemonRouter)

// Serve React client in production
if (env.isProduction) {
  const publicDir = path.join(__dirname, 'public')
  app.use(express.static(publicDir))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

httpServer.listen(env.port, () => {
  console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`)
})

export default app
