import fs from 'node:fs'
import { Router } from 'express'
import { z } from 'zod'
import * as repo from '../db/repo.js'
import { requireRole } from '../lib/auth.js'
import { setSetting, getSetting } from '../db/schema.js'
import { hashPassword } from '../lib/auth.js'
import { clearOrders, isDemoSeed } from '../db/seed.js'
import * as S from '../lib/serialize.js'
import uploadRoutes, { removeUploads, resolveUpload } from './uploads.js'

const router = Router()
const staff = requireRole('owner', 'counter', 'kitchen')

/** Does this /uploads URL still point at a file on disk? */
const fileExists = (uploadsDir, urlPath) => {
  const f = resolveUpload(uploadsDir, urlPath)
  return !!f && fs.existsSync(f)
}

router.use(uploadRoutes)

/* ------------------------------- dashboard ------------------------------ */

router.get('/dashboard', staff, (req, res) => {
  const db = req.db
  res.json({
    stats: repo.dashboardStats(db),
    live: repo.listOrders(db, { status: 'new,preparing,ready,out', limit: 40 }),
    activity: repo.recentActivity(db, 12),
    demoData: isDemoSeed(db),
    settings: repo.readSettings(db),
  })
})

/* --------------------------------- menu --------------------------------- */

router.get('/menu', requireRole('owner', 'counter'), (req, res) => {
  res.json({ menu: repo.listMenu(req.db, { includeUnavailable: true }), categories: repo.listCategories(req.db) })
})

const optSchema = z.object({
  group: z.string().min(1).max(40),
  required: z.boolean().optional(),
  multi: z.boolean().optional(),
  choices: z.array(z.object({ n: z.string().min(1).max(60), p: z.coerce.number().int().min(0) })).min(1),
})

const photoPath = z.string().trim().max(400).refine(
  (p) => /^\/?(uploads|assets)\//.test(p) || /^https?:\/\//.test(p),
  'A photo must be an uploaded file, an /assets path or a full URL',
)

const itemSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{2,32}$/, 'Use a short id of letters and numbers'),
  cat: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  descr: z.string().trim().max(400).optional().default(''),
  price: z.coerce.number().int().min(0).max(1_000_000),
  was: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  img: z.string().trim().max(400).optional().default(''),
  images: z.array(photoPath).max(8).optional(),
  tags: z.array(z.string().max(30)).max(6).optional().default([]),
  serves: z.coerce.number().int().min(1).max(50).nullable().optional(),
  available: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
  spice: z.coerce.number().int().min(0).max(3).optional().default(0),
  veg: z.boolean().optional().default(false),
  prepMins: z.coerce.number().int().min(1).max(180).optional().default(15),
  opts: z.array(optSchema).max(6).optional(),
})

router.post('/menu', requireRole('owner', 'counter'), (req, res) => {
  const parsed = itemSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the item' })
  if (!req.db.prepare('SELECT 1 FROM categories WHERE id = ?').get(parsed.data.cat)) {
    return res.status(400).json({ error: 'Unknown category' })
  }
  const exists = req.db.prepare('SELECT 1 FROM menu_items WHERE id = ?').get(parsed.data.id)
  const photos = parsed.data.images ?? (parsed.data.img ? [parsed.data.img] : [])
  const missing = photos.find((p) => p.startsWith('/uploads/') && !fileExists(req.uploadsDir, p))
  if (missing) return res.status(400).json({ error: 'One of the photos is no longer on the server' })
  res.status(exists ? 200 : 201).json({ item: repo.upsertMenuItem(req.db, { ...parsed.data, images: photos }) })
})

router.patch('/menu/:id', requireRole('owner', 'counter'), (req, res) => {
  const current = req.db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'Item not found' })
  const merged = {
    id: current.id,
    cat: req.body.cat ?? current.cat,
    name: req.body.name ?? current.name,
    descr: req.body.descr ?? current.descr,
    price: req.body.price ?? current.price,
    was: req.body.was !== undefined ? req.body.was : current.was,
    img: req.body.img ?? current.img,
    images: req.body.images ?? (repo.itemPhotos(req.db, current.id).length
      ? repo.itemPhotos(req.db, current.id)
      : (current.img ? [current.img] : [])),
    tags: req.body.tags ?? JSON.parse(current.tags || '[]'),
    serves: req.body.serves !== undefined ? req.body.serves : current.serves,
    available: req.body.available !== undefined ? req.body.available : !!current.available,
    featured: req.body.featured !== undefined ? req.body.featured : !!current.featured,
    spice: req.body.spice ?? current.spice,
    veg: req.body.veg !== undefined ? req.body.veg : !!current.veg,
    prepMins: req.body.prepMins ?? current.prep_mins,
    opts: req.body.opts,
  }
  const parsed = itemSchema.safeParse(merged)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the item' })

  const photos = parsed.data.images ?? (parsed.data.img ? [parsed.data.img] : [])
  const missing = photos.find((p) => p.startsWith('/uploads/') && !fileExists(req.uploadsDir, p))
  if (missing) return res.status(400).json({ error: 'One of the photos is no longer on the server' })

  const before = repo.itemPhotos(req.db, current.id)
  const item = repo.upsertMenuItem(req.db, { ...parsed.data, images: photos })
  // Anything the admin removed from the gallery is deleted from disk unless
  // another dish still uses it.
  removeUploads(req.db, req.uploadsDir, before.filter((p) => !photos.includes(p)))
  res.json({ item })
})

router.delete('/menu/:id', requireRole('owner', 'counter'), (req, res) => {
  const photos = repo.deleteMenuItem(req.db, req.params.id)
  if (!photos) return res.status(404).json({ error: 'Item not found' })
  removeUploads(req.db, req.uploadsDir, photos)
  res.json({ ok: true })
})

/* -------------------------------- promos -------------------------------- */

const promoSchema = z.object({
  id: z.string().min(2).max(40),
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Letters and numbers only'),
  type: z.enum(['pct', 'flat']),
  value: z.coerce.number().int().min(1),
  min: z.coerce.number().int().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
  cap: z.coerce.number().int().min(1).nullable().optional(),
  startsAt: z.coerce.number().int().nullable().optional(),
  endsAt: z.coerce.number().int().nullable().optional(),
})

router.get('/promos', requireRole('owner', 'counter'), (req, res) => {
  res.json({ promos: repo.listPromos(req.db) })
})

router.post('/promos', requireRole('owner'), (req, res) => {
  const parsed = promoSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the promo' })
  if (parsed.data.type === 'pct' && parsed.data.value > 100) return res.status(400).json({ error: 'Percentage cannot exceed 100' })
  res.json({ promo: repo.upsertPromo(req.db, parsed.data) })
})

router.delete('/promos/:id', requireRole('owner'), (req, res) => {
  if (!repo.deletePromo(req.db, req.params.id)) return res.status(404).json({ error: 'Promo not found' })
  res.json({ ok: true })
})

/* ------------------------------- customers ------------------------------ */

router.get('/customers', requireRole('owner', 'counter'), (req, res) => {
  res.json({ customers: repo.listCustomers(req.db, { q: req.query.q }) })
})

router.delete('/customers/:id', requireRole('owner'), (req, res) => {
  const row = req.db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Customer not found' })
  req.db.prepare('DELETE FROM customers WHERE id = ?').run(row.id)
  res.json({ ok: true })
})

/* -------------------------------- riders -------------------------------- */

router.get('/riders', requireRole('owner', 'counter'), (req, res) => {
  res.json({ riders: repo.listRiders(req.db) })
})

const riderSchema = z.object({
  id: z.string().min(1).max(20),
  name: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(30).optional().default(''),
  bike: z.string().trim().max(30).optional().default(''),
  active: z.boolean().optional().default(true),
  onShift: z.boolean().optional().default(false),
})

router.post('/riders', requireRole('owner', 'counter'), (req, res) => {
  const parsed = riderSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the rider' })
  res.json({ rider: repo.upsertRider(req.db, parsed.data) })
})

router.delete('/riders/:id', requireRole('owner', 'counter'), (req, res) => {
  try {
    const deleted = repo.deleteRider(req.db, req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Rider not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message })
  }
})

/* ----------------------------- reservations ----------------------------- */

router.get('/reservations', requireRole('owner', 'counter'), (req, res) => {
  res.json({ reservations: repo.listReservations(req.db, { day: req.query.day, status: req.query.status }) })
})

const RES_STATUSES = ['pending', 'confirmed', 'seated', 'cancelled', 'no_show']
router.patch('/reservations/:id', requireRole('owner', 'counter'), (req, res) => {
  const { status } = req.body || {}
  if (!RES_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' })
  const r = repo.setReservationStatus(req.db, req.params.id, status)
  if (!r) return res.status(404).json({ error: 'Reservation not found' })
  res.json({ reservation: r })
})

/* -------------------------------- reviews ------------------------------- */

router.get('/reviews', requireRole('owner', 'counter'), (req, res) => {
  res.json({ reviews: repo.listReviews(req.db, { approvedOnly: false }) })
})

router.patch('/reviews/:id', requireRole('owner', 'counter'), (req, res) => {
  const approved = !!req.body?.approved
  const r = repo.setReviewApproved(req.db, req.params.id, approved)
  if (!r) return res.status(404).json({ error: 'Review not found' })
  res.json({ review: r })
})

/* -------------------------------- settings ------------------------------ */

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  tagline: z.string().trim().max(120).optional(),
  address: z.string().trim().max(200).optional(),
  phone1: z.string().trim().max(30).optional(),
  phone2: z.string().trim().max(30).optional(),
  email: z.string().trim().max(120).optional(),
  hours: z.string().trim().max(60).optional(),
  open: z.boolean().optional(),
  acceptingOrders: z.boolean().optional(),
  deliveryFee: z.coerce.number().int().min(0).max(10000).optional(),
  freeDeliveryOver: z.coerce.number().int().min(0).max(1_000_000).optional(),
  minOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
  eta: z.coerce.number().int().min(5).max(180).optional(),
  radiusKm: z.coerce.number().min(0.5).max(100).optional(),
  taxPct: z.coerce.number().min(0).max(50).optional(),
  announcements: z.array(z.object({
    id: z.string().max(40), text: z.string().max(200), active: z.boolean().optional(),
  })).max(8).optional(),
})

router.get('/settings', staff, (req, res) => {
  res.json({ settings: repo.readSettings(req.db) })
})

router.put('/settings', requireRole('owner'), (req, res) => {
  const parsed = settingsSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the settings' })
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) setSetting(req.db, k, v)
  res.json({ settings: repo.readSettings(req.db) })
})

/* --------------------------------- staff -------------------------------- */

router.get('/staff', requireRole('owner'), (req, res) => {
  const rows = req.db.prepare('SELECT id,name,email,role,active,created_at FROM users ORDER BY created_at').all()
  res.json({ staff: rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: S.bool(u.active), createdAt: u.created_at })) })
})

const staffSchema = z.object({
  id: z.string().min(2).max(40),
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(200),
  role: z.enum(['owner', 'counter', 'kitchen', 'rider']),
})

router.post('/staff', requireRole('owner'), (req, res) => {
  const parsed = staffSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the details' })
  const { id, name, email, password, role } = parsed.data
  const dup = req.db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(email)
  if (dup) return res.status(409).json({ error: 'That email is already in use' })
  req.db.prepare('INSERT INTO users(id,name,email,pass_hash,role,active,created_at) VALUES(?,?,?,?,?,1,?)')
    .run(id, name, email, hashPassword(password), role, Date.now())
  res.status(201).json({ ok: true })
})

router.patch('/staff/:id', requireRole('owner'), (req, res) => {
  const { active, role, password, name } = req.body || {}
  const row = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Staff member not found' })
  if (active !== undefined) {
    // Deactivating the last owner would lock everyone out of the panel.
    if (!active && row.role === 'owner') {
      const owners = req.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND active = 1").get().n
      if (owners <= 1) return res.status(400).json({ error: 'You cannot deactivate the last owner account' })
    }
    req.db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, row.id)
  }
  if (role && ['owner', 'counter', 'kitchen', 'rider'].includes(role)) {
    req.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, row.id)
  }
  if (name) req.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, row.id)
  if (password) req.db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(String(password)), row.id)
  res.json({ ok: true })
})

router.delete('/staff/:id', requireRole('owner'), (req, res) => {
  const row = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Staff member not found' })
  if (row.role === 'owner') {
    const owners = req.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND active = 1").get().n
    if (owners <= 1) return res.status(400).json({ error: 'You cannot delete the last active owner account' })
  }
  if (row.id === req.auth.sub) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }
  req.db.prepare('DELETE FROM users WHERE id = ?').run(row.id)
  res.json({ ok: true })
})

/* ------------------------------- demo data ------------------------------ */

router.post('/demo-data/clear', requireRole('owner'), (req, res) => {
  clearOrders(req.db)
  res.json({ ok: true, demoData: false })
})

export default router
