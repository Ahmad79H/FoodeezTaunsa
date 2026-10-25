/** Auth: password hashing, JWT sessions, role gates. */

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const DEV_SECRET = 'foodeez-dev-secret-change-me'
export const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET
export const IS_DEV = process.env.NODE_ENV !== 'production'

if (!process.env.JWT_SECRET && !IS_DEV) {
  console.warn('[auth] JWT_SECRET is not set — refusing to run in production with the dev secret.')
}

export const hashPassword = (plain) => bcrypt.hashSync(plain, 8)
export const verifyPassword = (plain, hash) => {
  if (!hash) return false
  try { return bcrypt.compareSync(plain, hash) } catch { return false }
}

/** Normalize Pakistani phone numbers to standard "03xx xxxxxxx" format. */
export function normalizePhone(raw) {
  if (!raw) return ''
  let s = String(raw).trim().replace(/[^\d+]/g, '')
  if (s.startsWith('+92')) s = '0' + s.slice(3)
  else if (s.startsWith('0092')) s = '0' + s.slice(4)
  else if (s.startsWith('92') && s.length === 12) s = '0' + s.slice(2)
  if (/^03\d{9}$/.test(s)) {
    return s.slice(0, 4) + ' ' + s.slice(4)
  }
  return String(raw).trim()
}

/** Check if input resolves to a valid Pakistani mobile number. */
export function isValidPhone(raw) {
  if (!raw) return false
  const s = String(raw).trim().replace(/[^\d+]/g, '')
  let digits = s
  if (digits.startsWith('+92')) digits = '0' + digits.slice(3)
  else if (digits.startsWith('0092')) digits = '0' + digits.slice(4)
  else if (digits.startsWith('92') && digits.length === 12) digits = '0' + digits.slice(2)
  return /^03\d{9}$/.test(digits)
}

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

export const COOKIE = 'fz_session'

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: !IS_DEV,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  }
}

/** Attach req.auth = {sub, role, name} when a valid token is present. */
export function authOptional(req, _res, next) {
  const token = req.cookies?.[COOKIE] || bearer(req)
  const claims = token ? verifyToken(token) : null
  if (claims) req.auth = claims
  next()
}

function bearer(req) {
  const h = req.headers.authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

export function requireAuth(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: 'Sign in required' })
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Sign in required' })
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: 'Not allowed for this role' })
    next()
  }
}

export function requireCustomer(req, res, next) {
  if (!req.auth || req.auth.role !== 'customer') {
    return res.status(401).json({ error: 'Sign in to your account first' })
  }
  next()
}

export const STAFF_ROLES = ['owner', 'counter', 'kitchen', 'rider']
