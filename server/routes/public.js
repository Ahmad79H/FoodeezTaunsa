import { Router } from 'express'
import { z } from 'zod'
import * as repo from '../db/repo.js'
import { trackToken, safeEqual } from '../lib/token.js'
import { applyPromo } from '../lib/pricing.js'
import { readSettings } from '../db/repo.js'
import * as S from '../lib/serialize.js'
import { normalizePhone, isValidPhone } from '../lib/auth.js'

const router = Router()

/* ------------------------------- catalogue ------------------------------ */

router.get('/bootstrap', (req, res) => {
  const db = req.db
  const settings = readSettings(db)
  const menu = repo.listMenu(db)
  const reviews = repo.listReviews(db).slice(0, 6)
  res.json({
    settings,
    categories: repo.listCategories(db),
    menu,
    featured: menu.filter((m) => m.featured).slice(0, 6),
    deals: menu.filter((m) => m.cat === 'deals'),
    reviews,
    reviewSummary: repo.reviewSummary(db),
    promos: repo.listPromos(db).filter((p) => p.active).map(({ code, type, value, min }) => ({ code, type, value, min })),
  })
})

router.get('/menu', (req, res) => {
  res.json({ menu: repo.listMenu(req.db), categories: repo.listCategories(req.db) })
})

router.get('/categories', (req, res) => {
  res.json({ categories: repo.listCategories(req.db) })
})

router.get('/menu/:id', (req, res) => {
  const item = repo.getMenuItem(req.db, req.params.id)
  if (!item) return res.status(404).json({ error: 'Item not found' })
  res.json({ item })
})

router.get('/settings', (req, res) => {
  res.json({ settings: readSettings(req.db) })
})

/* -------------------------------- promos -------------------------------- */

router.post('/promo/validate', (req, res) => {
  const { code, subtotal } = req.body || {}
  const db = req.db
  const row = db.prepare('SELECT * FROM promos WHERE UPPER(code) = UPPER(?)').get(String(code || '').trim())
  const { promo, discount, error } = applyPromo(row ? S.promo(row) : null, Number(subtotal) || 0)
  if (error) return res.status(200).json({ ok: false, error })
  res.json({ ok: true, code: promo.code, discount })
})

/* -------------------------------- reviews ------------------------------- */

router.get('/reviews', (req, res) => {
  const db = req.db
  res.json({ reviews: repo.listReviews(db), summary: repo.reviewSummary(db) })
})

const reviewSchema = z.object({
  name: z.string().trim().min(2).max(60),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(4).max(800),
  orderId: z.string().trim().max(40).optional(),
})

const reviewTimes = new Map()
router.post('/reviews', (req, res) => {
  const key = req.ip
  const last = reviewTimes.get(key) || 0
  if (Date.now() - last < 60_000) return res.status(429).json({ error: 'Please wait a moment before posting again.' })

  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your review' })

  reviewTimes.set(key, Date.now())
  const r = repo.createReview(req.db, { ...parsed.data, approved: false })
  res.status(201).json({ review: r, message: 'Thanks! Your review will appear once approved.' })
})

/* ----------------------------- reservations ----------------------------- */

router.get('/reservations/slots', (req, res) => {
  const { day, time } = req.query
  if (!day || !time) return res.status(400).json({ error: 'day and time are required' })
  res.json(repo.slotCapacity(req.db, String(day), String(time)))
})

const resSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().refine(isValidPhone, 'Enter a valid mobile number, e.g. 0333 1234567'),
  guests: z.coerce.number().int().min(1).max(40),
  day: z.string().trim().min(1).max(40),
  time: z.string().trim().min(1).max(40),
  note: z.string().trim().max(300).optional(),
})

router.post('/reservations', (req, res) => {
  const parsed = resSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your details' })

  const { day, time, guests } = parsed.data
  const cap = repo.slotCapacity(req.db, day, time)
  if (cap.available < guests) {
    return res.status(409).json({
      error: cap.available === 0
        ? 'That sitting is fully booked. Please pick another time.'
        : `Only ${cap.available} seat${cap.available === 1 ? '' : 's'} left for that sitting.`,
      capacity: cap,
    })
  }
  const r = repo.createReservation(req.db, { ...parsed.data, phone: normalizePhone(parsed.data.phone) })
  res.status(201).json({ reservation: r })
})

/* ------------------------------ order tracking -------------------------- */

router.get('/track/:id/:token', (req, res) => {
  const { id, token } = req.params
  if (!safeEqual(token, trackToken(id))) return res.status(404).json({ error: 'Order not found' })
  const order = repo.getOrder(req.db, id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json({ order })
})

export default router
export { trackToken }
