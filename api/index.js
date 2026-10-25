/**
 * Vercel serverless entry point.
 *
 * This exists only so the demo can be shown on a vercel.app URL. The real
 * deployment target is `node server/index.js` on the restaurant's own hosting.
 *
 * Vercel functions have a read-only filesystem apart from /tmp, and /tmp is
 * per-instance, so the SQLite database is rebuilt from the seed on a cold
 * start. Orders do not survive between cold starts — that is fine for a
 * walkthrough, not for a live restaurant.
 */

import { createApp } from '../server/app.js'
import { openDB } from '../server/db/schema.js'
import { seed } from '../server/db/seed.js'

function build() {
  const file = process.env.DATABASE_PATH || '/tmp/foodeez.db'
  const db = openDB(file)
  seed(db, { historyDays: Number(process.env.DEMO_HISTORY_DAYS ?? 1) })
  return createApp(db, { uploadsDir: '/tmp/foodeez-uploads' })
}

// Reuse the instance between warm invocations.
const app = globalThis.__foodeezApp || (globalThis.__foodeezApp = build())

export default app
