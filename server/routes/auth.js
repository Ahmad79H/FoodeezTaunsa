import { Router } from 'express'
import { z } from 'zod'
import {
  hashPassword, verifyPassword, signToken, COOKIE, cookieOptions, requireAuth,
  normalizePhone, isValidPhone,
} from '../lib/auth.js'
import * as S from '../lib/serialize.js'

const router = Router()

/* ---- naive brute-force guard (per IP+identifier, 10 tries / 10 min) ---- */
const attempts = new Map()
const WINDOW = 10 * 60 * 1000
const MAX = 10

function throttle(key) {
  const t = Date.now()
  const rec = attempts.get(key)
  if (!rec || t - rec.first > WINDOW) {
    attempts.set(key, { first: t, n: 1 })
    return true
  }
  rec.n += 1
  return rec.n <= MAX
}
function resetThrottle(key) { attempts.delete(key) }

const phoneRe = /^(\+92[\s-]?|0092[\s-]?|92[\s-]?)?0?3\d{2}[\s-]?\d{3}[\s-]?\d{4}$/

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  phone: z.string().trim().refine(isValidPhone, 'Enter a valid mobile number, e.g. 0333 1234567'),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  email: z.string().trim().email().optional().or(z.literal('')),
  address: z.string().trim().max(300).optional(),
})

/* ------------------------------ customers ------------------------------ */

router.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your details' })
  }
  const { name, phone, password, email, address } = parsed.data
  const cleanPhone = normalizePhone(phone)
  const compactPhone = cleanPhone.replace(/\s/g, '')
  const rawPhone = String(phone).trim()
  const db = req.db

  const existing = db.prepare('SELECT * FROM customers WHERE phone = ? OR phone = ? OR phone = ?')
    .get(cleanPhone, rawPhone, compactPhone)
  if (existing?.pass_hash) {
    return res.status(409).json({ error: 'An account already exists for this number. Sign in instead.' })
  }

  const passHash = hashPassword(password)
  const now = Date.now()
  let customerId = existing?.id

  if (existing) {
    db.prepare('UPDATE customers SET name=?, phone=?, email=COALESCE(?, email), address=COALESCE(NULLIF(?, \'\'), address), pass_hash=? WHERE id=?')
      .run(name, cleanPhone, email || null, address || existing.address || '', passHash, existing.id)
  } else {
    customerId = 'c_' + Math.random().toString(36).slice(2, 10)
    db.prepare('INSERT INTO customers(id,name,phone,email,address,note,pass_hash,points,created_at) VALUES(?,?,?,?,?,?,?,0,?)')
      .run(customerId, name, cleanPhone, email || null, address || '', '', passHash, now)
  }

  // Link any past guest orders placed with this phone number to the newly registered customer
  try {
    db.prepare(`UPDATE orders SET customer_id = ? WHERE (customer_id IS NULL OR customer_id = '') AND id IN (
      SELECT order_id FROM order_customers WHERE phone = ? OR phone = ? OR phone = ?
    )`).run(customerId, cleanPhone, rawPhone, compactPhone)
  } catch {}

  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)
  const token = signToken({ sub: row.id, role: 'customer', name: row.name })
  res.cookie(COOKIE, token, cookieOptions())
  res.status(201).json({ token, user: { ...S.customer(row), role: 'customer' } })
})

router.post('/login', (req, res) => {
  const { phone, password } = req.body || {}
  if (!phone || !password) return res.status(400).json({ error: 'Enter your number and password' })

  const cleanPhone = normalizePhone(phone)
  const compactPhone = cleanPhone.replace(/\s/g, '')
  const rawPhone = String(phone).trim()

  const key = `c:${req.ip}:${cleanPhone}`
  if (!throttle(key)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' })

  const row = req.db.prepare('SELECT * FROM customers WHERE phone = ? OR phone = ? OR phone = ?')
    .get(cleanPhone, rawPhone, compactPhone)
  if (!row || !row.pass_hash || !verifyPassword(String(password), row.pass_hash)) {
    return res.status(401).json({ error: 'Number or password is incorrect' })
  }
  resetThrottle(key)
  const token = signToken({ sub: row.id, role: 'customer', name: row.name })
  res.cookie(COOKIE, token, cookieOptions())
  res.json({ token, user: { ...S.customer(row), role: 'customer' } })
})

/* -------------------------------- staff -------------------------------- */

router.post('/staff/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password' })

  const key = `s:${req.ip}:${email}`
  if (!throttle(key)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' })

  const row = req.db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(String(email).trim())
  if (!row || !row.active || !verifyPassword(String(password), row.pass_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect' })
  }
  resetThrottle(key)
  const token = signToken({ sub: row.id, role: row.role, name: row.name })
  res.cookie(COOKIE, token, cookieOptions())
  res.json({ token, user: { id: row.id, name: row.name, email: row.email, role: row.role } })
})

/* -------------------------------- shared ------------------------------- */

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  const { sub, role } = req.auth
  if (role === 'customer') {
    const row = req.db.prepare('SELECT * FROM customers WHERE id = ?').get(sub)
    if (!row) return res.status(401).json({ error: 'Account not found' })
    return res.json({ user: { ...S.customer(row), role: 'customer' } })
  }
  const row = req.db.prepare('SELECT id,name,email,role,active FROM users WHERE id = ?').get(sub)
  if (!row || !row.active) return res.status(401).json({ error: 'Account not found' })
  res.json({ user: { id: row.id, name: row.name, email: row.email, role: row.role } })
})

router.patch('/me', requireAuth, (req, res) => {
  if (req.auth.role !== 'customer') return res.status(400).json({ error: 'Only customer profiles can be edited here' })
  const { name, address, email } = req.body || {}
  req.db.prepare(`UPDATE customers SET
      name = COALESCE(NULLIF(?, ''), name),
      address = COALESCE(?, address),
      email = COALESCE(?, email)
    WHERE id = ?`).run(name || '', address ?? null, email ?? null, req.auth.sub)
  const row = req.db.prepare('SELECT * FROM customers WHERE id = ?').get(req.auth.sub)
  res.json({ user: { ...S.customer(row), role: 'customer' } })
})

router.post('/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {}
  if (!next || String(next).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' })

  if (req.auth.role === 'customer') {
    const row = req.db.prepare('SELECT * FROM customers WHERE id = ?').get(req.auth.sub)
    if (!row) return res.status(404).json({ error: 'Account not found' })
    if (row.pass_hash && !verifyPassword(String(current || ''), row.pass_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    req.db.prepare('UPDATE customers SET pass_hash = ? WHERE id = ?').run(hashPassword(String(next)), row.id)
    return res.json({ ok: true })
  }

  const row = req.db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth.sub)
  if (!row) return res.status(404).json({ error: 'Account not found' })
  if (!verifyPassword(String(current || ''), row.pass_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }
  req.db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(String(next)), row.id)
  res.json({ ok: true })
})

export default router
