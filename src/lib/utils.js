/** Formatting + small pure helpers shared by the site and the admin. */

export const rs = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-PK')

export const cn = (...parts) => parts.filter(Boolean).join(' ')

export function clock(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function dayLabel(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  const diff = Math.round((today - that) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export function minsAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function etaMinutes(order, etaBase = 35) {
  if (!order) return etaBase
  const elapsed = Math.round((Date.now() - order.createdAt) / 60000)
  return Math.max(5, etaBase - elapsed)
}

export const STATUS_LABEL = {
  new: 'Order placed',
  preparing: 'In the kitchen',
  ready: 'Ready',
  out: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const STATUS_SHORT = {
  new: 'New', preparing: 'Preparing', ready: 'Ready',
  out: 'Out', delivered: 'Delivered', cancelled: 'Cancelled',
}

export const PAY_LABEL = { cod: 'Cash', jazzcash: 'JazzCash', easypaisa: 'easypaisa', card: 'Card' }

export const DAYS = ['Today', 'Tomorrow']
export function dayOptions() {
  const out = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i)
    out.push({ value: d.toISOString().slice(0, 10), label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) })
  }
  return out
}

export const TIMES = ['1:00 PM', '2:00 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '11:00 PM']

/** Mirror of the server's option rule, used only for cart display. */
export function unitPrice(item, choiceIds = []) {
  if (!item) return 0
  let unit = item.price
  for (const g of item.opts || []) {
    const picked = g.choices.filter((c) => choiceIds.includes(c.id))
    for (const c of picked) unit = g.required ? (c.p > 0 ? c.p : item.price) : unit + c.p
  }
  return unit
}

export function optionLabel(item, choiceIds = []) {
  if (!item) return ''
  const out = []
  for (const g of item.opts || []) {
    for (const c of g.choices) if (choiceIds.includes(c.id)) out.push(c.n)
  }
  return out.join(', ')
}

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

/** Absolute URL for an asset path returned by the API. */
export const asset = (p) => {
  if (!p) return ''
  if (/^https?:/i.test(p) || p.startsWith('data:') || p.startsWith('/')) return p
  return '/' + p.replace(/^\/+/, '')
}

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
