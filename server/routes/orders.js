import { Router } from 'express'
import { z } from 'zod'
import * as repo from '../db/repo.js'
import { requireAuth, requireRole, STAFF_ROLES, normalizePhone, isValidPhone } from '../lib/auth.js'
import { PriceError } from '../lib/pricing.js'
import { trackToken, safeEqual } from '../lib/token.js'

const router = Router()

const lineSchema = z.object({
  itemId: z.string().min(1),
  qty: z.coerce.number().int().min(1).max(20),
  choices: z.array(z.coerce.number().int()).max(12).optional(),
  note: z.string().max(200).optional(),
})

const createSchema = z.object({
  type: z.enum(['delivery', 'pickup']),
  lines: z.array(lineSchema).min(1).max(40),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().refine(isValidPhone, 'Enter a valid mobile number, e.g. 0333 1234567'),
  address: z.string().trim().max(300).optional().default(''),
  landmark: z.string().trim().max(120).optional().default(''),
  note: z.string().trim().max(500).optional().default(''),
  payMethod: z.enum(['cod', 'jazzcash', 'easypaisa', 'card']).default('cod'),
  promoCode: z.string().trim().max(30).optional().nullable(),
})

/* --------------------------- place an order ---------------------------- */

router.post('/', requireAuth, (req, res) => {
  // Accounts are required to order: it is how a customer sees their history,
  // their points and their live tracking afterwards.
  if (req.auth.role !== 'customer') {
    return res.status(403).json({ error: 'Sign in with a customer account to place an order' })
  }

  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your details' })
  }
  const d = parsed.data
  const db = req.db

  if (d.type === 'delivery' && d.address.trim().length < 6) {
    return res.status(400).json({ error: 'We need a full address to deliver' })
  }

  const landmark = d.landmark.replace(/^\s*near\s+/i, '').trim()
  const address = d.type === 'delivery'
    ? d.address + (landmark ? ` (near ${landmark})` : '')
    : ''

  const customerId = req.auth.sub
  const cleanPhone = normalizePhone(d.phone)

  try {
    // Ensure customer row exists with this customerId so the foreign key constraint never fails
    const existingCust = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId)
    if (!existingCust) {
      db.prepare(`INSERT INTO customers(id,name,phone,email,address,note,pass_hash,points,created_at)
        VALUES(?,?,?,?,?,?,NULL,0,?)`
      ).run(customerId, d.name, cleanPhone, '', address, '', Date.now())
    } else {
      db.prepare(`UPDATE customers SET name = ?, address = COALESCE(NULLIF(?, ''), address) WHERE id = ?`)
        .run(d.name, address, customerId)
    }

    const order = repo.createOrder(db, {
      type: d.type,
      lines: d.lines,
      customer: { name: d.name, phone: cleanPhone, address },
      payMethod: d.payMethod,
      note: d.note,
      promoCode: d.promoCode || null,
      channel: 'web',
      customerId,
    })

    res.status(201).json({ order, trackToken: trackToken(order.id) })
  } catch (e) {
    if (e instanceof PriceError) return res.status(e.status || 400).json({ error: e.message })
    console.error('[orders:create]', e)
    const errText = e.message && !e.message.includes('SqliteError') ? e.message : 'Could not place the order. Please try again.'
    res.status(500).json({ error: errText })
  }
})

/* --------------------------- customer history -------------------------- */

router.get('/mine', requireAuth, (req, res) => {
  if (req.auth.role !== 'customer') return res.status(400).json({ error: 'Customer account required' })
  const rows = req.db.prepare('SELECT id FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.auth.sub)
  res.json({ orders: rows.map((r) => ({ ...repo.getOrder(req.db, r.id), trackToken: trackToken(r.id) })) })
})

/* ------------------------------ staff views ---------------------------- */

router.get('/', requireRole(...STAFF_ROLES), (req, res) => {
  const { status, type, q, limit, since, channel } = req.query
  const orders = repo.listOrders(req.db, { status, type, q, limit, since, channel })
  res.json({ orders: orders.map((o) => ({ ...o, trackToken: trackToken(o.id) })) })
})

router.get('/:id', (req, res) => {
  const order = repo.getOrder(req.db, req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const staff = req.auth && STAFF_ROLES.includes(req.auth.role)
  const owner = req.auth?.role === 'customer' && req.db
    .prepare('SELECT 1 FROM orders WHERE id = ? AND customer_id = ?')
    .get(req.params.id, req.auth.sub)
  const token = req.query.token
  const tokenOk = token && safeEqual(token, trackToken(req.params.id))

  if (!staff && !owner && !tokenOk) return res.status(403).json({ error: 'Not allowed' })
  res.json({ order, trackToken: trackToken(order.id) })
})

/* ----------------------------- status changes -------------------------- */

router.patch('/:id/status', requireRole('owner', 'counter', 'kitchen'), (req, res) => {
  const { status, reason } = req.body || {}
  const allowed = ['new', 'preparing', 'ready', 'out', 'delivered', 'cancelled']
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Unknown status' })

  const result = repo.setOrderStatus(req.db, req.params.id, status, req.auth.name || req.auth.role, { reason })
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.json({ order: result.order })
})

router.post('/:id/assign', requireRole('owner', 'counter'), (req, res) => {
  const result = repo.assignRider(req.db, req.params.id, req.body?.riderId || null, req.auth.name)
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.json({ order: result.order })
})

router.post('/:id/cancel', (req, res) => {
  const order = req.db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const staff = req.auth && STAFF_ROLES.includes(req.auth.role)
  const own = req.auth?.role === 'customer' && order.customer_id === req.auth.sub
  const token = req.body?.token
  const tokenOk = token && safeEqual(token, trackToken(req.params.id))

  if (!staff && !own && !tokenOk) return res.status(403).json({ error: 'Not allowed' })
  if (['out', 'delivered'].includes(order.status)) {
    return res.status(409).json({ error: 'This order is already on its way — please call the restaurant.' })
  }
  const result = repo.setOrderStatus(req.db, req.params.id, 'cancelled',
    req.auth?.name || 'customer', { reason: req.body?.reason || 'Cancelled by customer' })
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.json({ order: result.order })
})

/* -------------------------------- rating ------------------------------- */

router.post('/:id/rate', (req, res) => {
  const { rating, body, token } = req.body || {}
  const r = Number(rating)
  if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'Pick 1 to 5 stars' })

  const order = req.db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const staff = req.auth && STAFF_ROLES.includes(req.auth.role)
  const own = req.auth?.role === 'customer' && order.customer_id === req.auth.sub
  const tokenOk = token && safeEqual(token, trackToken(req.params.id))
  if (!staff && !own && !tokenOk) return res.status(403).json({ error: 'Not allowed' })

  const name = req.auth?.name || req.db.prepare('SELECT name FROM order_customers WHERE order_id = ?').get(req.params.id)?.name || 'Customer'
  const result = repo.rateOrder(req.db, req.params.id, r, String(body || ''), name)
  if (result.error) return res.status(result.status || 400).json({ error: result.error })
  res.json({ ok: true })
})

export default router
