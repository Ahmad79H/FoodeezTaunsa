import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'
import { authOptional } from './lib/auth.js'
import { addClient, clientCount } from './lib/sse.js'
import authRoutes from './routes/auth.js'
import publicRoutes from './routes/public.js'
import orderRoutes from './routes/orders.js'
import adminRoutes from './routes/admin.js'

/**
 * Build the Express app around an already-open database.
 * Kept separate from index.js so tests can mount it without a real port.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))

export function createApp(db, options = {}) {
  const uploadsDir = path.resolve(options.uploadsDir || path.join(HERE, '..', 'data', 'uploads'))
  const publicDir = path.resolve(options.publicDir || path.join(HERE, '..', 'public'))
  fs.mkdirSync(uploadsDir, { recursive: true })

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(authOptional)

  // Dish photos. Immutable filenames, so they can be cached hard.
  app.use('/uploads', express.static(uploadsDir, {
    index: false,
    maxAge: '30d',
    immutable: true,
    dotfiles: 'ignore',
  }))
  // A missing photo is a plain 404 — not the app shell, and not an error log line.
  app.use('/uploads', (_req, res) => res.status(404).type('text/plain').send('Not found'))

  // every API handler gets the db + the folders it may touch
  app.use('/api', (req, _res, next) => {
    req.db = db
    req.uploadsDir = uploadsDir
    req.publicDir = publicDir
    next()
  })

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), sseClients: clientCount() })
  })

  // realtime channel
  app.get('/api/events', (req, res) => {
    const scope = req.query.scope === 'kitchen' ? 'kitchen' : '*'
    addClient(res, scope)
  })

  app.use('/api/auth', authRoutes)
  app.use('/api', publicRoutes)
  app.use('/api/orders', orderRoutes)
  app.use('/api/admin', adminRoutes)

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint' }))

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    console.error('[api:error]', err)
    if (res.headersSent) return
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Something went wrong' })
  })

  return app
}
