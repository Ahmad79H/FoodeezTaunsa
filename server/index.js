/**
 * Foodeez server.
 *
 * One process serves the API, the realtime channel and the built frontend.
 * In development Vite runs in middleware mode so there is a single port and
 * HMR still works.
 *
 * Nothing here is Vercel-specific: `node server/index.js` is enough on a VPS,
 * on the restaurant's own domain, or behind nginx.
 */

import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

import 'dotenv/config'
import { openDB } from './db/schema.js'
import { seed } from './db/seed.js'
import { createApp } from './app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')

const DEV = process.env.NODE_ENV !== 'production'
const PORT = Number(process.env.PORT || (DEV ? 4000 : 3000))

/* ------------------------------- database ------------------------------- */

const dataDir = process.env.DATA_DIR || path.join(ROOT, 'data')
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'foodeez.db')

if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = openDB(dbPath)
const result = seed(db, { historyDays: Number(process.env.DEMO_HISTORY_DAYS ?? 7) })
if (result.seeded) {
  console.log('[db] seeded catalogue + demo history')
} else {
  console.log('[db] existing database at', dbPath)
}

/* -------------------------------- server -------------------------------- */

const uploadsDir = process.env.UPLOADS_DIR || path.join(dataDir, 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const app = createApp(db, { uploadsDir })
const server = http.createServer(app)

if (DEV) {
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({
    root: ROOT,
    appType: 'custom',
    server: { middlewareMode: true, hmr: { server } },
  })

  app.use(vite.middlewares)

  const pageFor = (url) => {
    if (url.startsWith('/admin')) return 'admin.html'
    if (url.startsWith('/prd')) return 'prd.html'
    return 'index.html'
  }

  app.use(async (req, res, next) => {
    if (req.method !== 'GET') return next()
    const url = req.originalUrl
    const file = path.join(ROOT, pageFor(url))
    if (!fs.existsSync(file)) return next()
    try {
      let html = fs.readFileSync(file, 'utf-8')
      html = await vite.transformIndexHtml(url, html)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      vite.ssrFixStacktrace(e)
      next(e)
    }
  })
} else {
  const dist = path.join(ROOT, 'dist')
  app.use(expressStatic(dist))

  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    const url = req.path
    if (url.startsWith('/api')) return next()

    // A missing file that has an extension is a 404 — never the HTML shell.
    if (path.extname(url)) return res.status(404).type('text/plain').send('Not found')

    const page = url.startsWith('/admin') ? 'admin.html' : url.startsWith('/prd') ? 'prd.html' : 'index.html'
    const file = path.join(dist, page)
    if (!fs.existsSync(file)) return next()
    res.sendFile(file)
  })
}

function expressStatic(dir) {
  return (req, res, next) => {
    // Tiny static handler: correct MIME + long cache for hashed assets.
    const rel = decodeURIComponent(req.path)
    if (rel.includes('..')) return next()
    const file = path.join(dir, rel)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next()

    const ext = path.extname(file).toLowerCase()
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
      '.mp4': 'video/mp4', '.webm': 'video/webm',
      '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
      '.ico': 'image/x-icon', '.map': 'application/json',
    }
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
    const hashed = /\-[A-Za-z0-9_]{8}\.(js|css|woff2?|png|jpg|svg)$/.test(rel)
    if (rel.startsWith('/_bundle/') || hashed) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else if (rel.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=86400')
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300')
    }
    res.sendFile(file, { acceptRanges: true, cacheControl: false })
  }
}

server.listen(PORT, () => {
  console.log(`\n  Foodeez ${DEV ? 'dev' : 'production'} server`)
  console.log(`  → http://localhost:${PORT}`)
  console.log(`  → http://localhost:${PORT}/admin\n`)
})

/* graceful shutdown so SQLite WAL is checkpointed cleanly */
let closing = false
const shutdown = (signal) => {
  if (closing) return
  closing = true
  console.log(`\n[server] ${signal} — shutting down`)
  server.close(() => {
    try { db.close() } catch {}
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 4000).unref()
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

export { app, server, db }
