import crypto from 'node:crypto'
import { JWT_SECRET } from './auth.js'

/** Opaque, unguessable handle for a public order-tracking link. */
export function trackToken(orderId) {
  return crypto.createHmac('sha256', JWT_SECRET).update('track:' + orderId).digest('base64url').slice(0, 24)
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''))
  const y = Buffer.from(String(b ?? ''))
  if (x.length !== y.length) return false
  return crypto.timingSafeEqual(x, y)
}

export const randomId = (prefix, len = 8) =>
  prefix + crypto.randomBytes(16).toString('base64url').slice(0, len)
