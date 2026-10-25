/** Read/write helpers. Routes stay thin; all SQL lives here. */

import { randomUUID } from 'node:crypto'
import { broadcast } from '../lib/sse.js'
import { unitPrice, applyPromo, deliveryFee, nextStatusFor, pointsEarned, PriceError } from '../lib/pricing.js'
import { getSetting } from '../db/schema.js'
import * as S from '../lib/serialize.js'

export const now = () => Date.now()

/* ------------------------------- settings ------------------------------- */

const SETTING_KEYS = [
  'name', 'tagline', 'address', 'phone1', 'phone2', 'email', 'hours', 'open',
  'deliveryFee', 'freeDeliveryOver', 'minOrder', 'eta', 'radiusKm', 'taxPct',
  'acceptingOrders', 'announcements',
]

export function readSettings(db) {
  const out = {}
  for (const k of SETTING_KEYS) out[k] = getSetting(db, k)
  return out
}

/* --------------------------------- menu --------------------------------- */

export function listCategories(db) {
  return db.prepare('SELECT * FROM categories ORDER BY sort').all().map(S.category)
}

/** Load option groups + choices for a set of item ids. */
function groupsFor(db, ids) {
  if (!ids.length) return new Map()
  const ph = ids.map(() => '?').join(',')
  const groups = db.prepare(
    `SELECT * FROM option_groups WHERE item_id IN (${ph}) ORDER BY item_id, sort, id`,
  ).all(...ids)
  const gids = groups.map((g) => g.id)
  const choices = gids.length
    ? db.prepare(`SELECT * FROM option_choices WHERE group_id IN (${gids.map(() => '?').join(',')}) ORDER BY sort, id`).all(...gids)
    : []
  const byGroup = new Map()
  for (const c of choices) {
    if (!byGroup.has(c.group_id)) byGroup.set(c.group_id, [])
    byGroup.get(c.group_id).push(c)
  }
  const out = new Map()
  for (const g of groups) {
    if (!out.has(g.item_id)) out.set(g.item_id, [])
    out.get(g.item_id).push({ ...g, choices: byGroup.get(g.id) || [] })
  }
  return out
}

/** item_id → ordered list of photo paths (index 0 is the cover). */
function imagesFor(db, ids) {
  if (!ids.length) return new Map()
  const ph = ids.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT item_id, path FROM menu_item_images WHERE item_id IN (${ph}) ORDER BY item_id, sort, created_at`,
  ).all(...ids)
  const out = new Map()
  for (const r of rows) {
    if (!out.has(r.item_id)) out.set(r.item_id, [])
    out.get(r.item_id).push(r.path)
  }
  return out
}

export function itemPhotos(db, itemId) {
  return imagesFor(db, [itemId]).get(itemId) || []
}

/** Replace an item's gallery. `paths` is the full ordered list. */
export function setItemPhotos(db, itemId, paths) {
  const clean = (paths || []).filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim())
  db.prepare('DELETE FROM menu_item_images WHERE item_id = ?').run(itemId)
  const ins = db.prepare('INSERT INTO menu_item_images(id,item_id,path,sort,created_at) VALUES(?,?,?,?,?)')
  const at = now()
  clean.forEach((p, i) => ins.run(randomUUID(), itemId, p, i, at))
  db.prepare('UPDATE menu_items SET img = ? WHERE id = ?').run(clean[0] || '', itemId)
  return clean
}

export function listMenu(db, { includeUnavailable = false } = {}) {
  const rows = db.prepare(
    `SELECT * FROM menu_items ${includeUnavailable ? '' : 'WHERE available = 1'} ORDER BY cat, sort, name`,
  ).all()
  const ids = rows.map((r) => r.id)
  const g = groupsFor(db, ids)
  const imgs = imagesFor(db, ids)
  return rows.map((item) => S.menuItem({ item, groups: g.get(item.id) || [], images: imgs.get(item.id) }))
}

export function getMenuItem(db, id, { includeUnavailable = false } = {}) {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id)
  if (!item) return null
  if (!includeUnavailable && !item.available) return null
  const g = groupsFor(db, [id])
  return S.menuItem({ item, groups: g.get(id) || [], images: imagesFor(db, [id]).get(id) })
}

export function upsertMenuItem(db, data) {
  const t = now()
  const exists = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(data.id)
  if (exists) {
    db.prepare(`UPDATE menu_items SET cat=?,name=?,descr=?,price=?,was=?,img=?,tags=?,serves=?,
      available=?,featured=?,spice=?,veg=?,prep_mins=? WHERE id=?`).run(
      data.cat, data.name, data.descr ?? '', data.price, data.was ?? null, data.img ?? '',
      JSON.stringify(data.tags ?? []), data.serves ?? null,
      data.available ? 1 : 0, data.featured ? 1 : 0, data.spice ?? 0, data.veg ? 1 : 0,
      data.prepMins ?? 15, data.id,
    )
  } else {
    db.prepare(`INSERT INTO menu_items
      (id,cat,name,descr,price,was,img,tags,serves,available,featured,spice,veg,prep_mins,sort,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      data.id, data.cat, data.name, data.descr ?? '', data.price, data.was ?? null,
      data.img ?? '', JSON.stringify(data.tags ?? []), data.serves ?? null,
      data.available === false ? 0 : 1, data.featured ? 1 : 0, data.spice ?? 0,
      data.veg ? 1 : 0, data.prepMins ?? 15, 999, t,
    )
  }
  if (Array.isArray(data.opts)) {
    db.prepare('DELETE FROM option_groups WHERE item_id = ?').run(data.id)
    const insG = db.prepare('INSERT INTO option_groups(item_id,label,required,multi,sort) VALUES(?,?,?,?,?)')
    const insC = db.prepare('INSERT INTO option_choices(group_id,label,delta,sort) VALUES(?,?,?,?)')
    data.opts.forEach((g, gi) => {
      const r = insG.run(data.id, g.group, g.required ? 1 : 0, g.multi ? 1 : 0, gi)
      const gid = Number(r.lastInsertRowid)
      ;(g.choices || []).forEach((c, ci) => insC.run(gid, c.n, c.p, ci))
    })
  }
  // `images` is the full ordered gallery; sort 0 also becomes `menu_items.img`.
  if (Array.isArray(data.images)) setItemPhotos(db, data.id, data.images)
  return getMenuItem(db, data.id, { includeUnavailable: true })
}

export function deleteMenuItem(db, id) {
  const photos = itemPhotos(db, id)
  const ok = db.prepare('DELETE FROM menu_items WHERE id = ?').run(id).changes > 0
  return ok ? photos : null
}

/** True when no dish still points at this photo. */
export function photoInUse(db, path) {
  return !!db.prepare('SELECT 1 FROM menu_item_images WHERE path = ? LIMIT 1').get(path)
}

/* -------------------------------- promos -------------------------------- */

export function listPromos(db) {
  return db.prepare('SELECT * FROM promos ORDER BY created_at DESC').all().map(S.promo)
}

export function findPromo(db, code) {
  if (!code) return null
  return S.promo(db.prepare('SELECT * FROM promos WHERE UPPER(code) = UPPER(?)').get(String(code).trim()))
}

export function upsertPromo(db, p) {
  const row = db.prepare('SELECT * FROM promos WHERE id = ?').get(p.id)
  if (row) {
    db.prepare('UPDATE promos SET code=?,type=?,value=?,min=?,active=?,cap=?,starts_at=?,ends_at=? WHERE id=?')
      .run(p.code, p.type, p.value, p.min ?? 0, p.active ? 1 : 0, p.cap ?? null,
        p.startsAt ?? null, p.endsAt ?? null, p.id)
  } else {
    db.prepare('INSERT INTO promos(id,code,type,value,min,active,uses,cap,starts_at,ends_at,created_at) VALUES(?,?,?,?,?,?,0,?,?,?,?)')
      .run(p.id, p.code, p.type, p.value, p.min ?? 0, p.active ? 1 : 0,
        p.cap ?? null, p.startsAt ?? null, p.endsAt ?? null, now())
  }
  return S.promo(db.prepare('SELECT * FROM promos WHERE id = ?').get(p.id))
}

export function deletePromo(db, id) {
  return db.prepare('DELETE FROM promos WHERE id = ?').run(id).changes > 0
}

/* -------------------------------- orders -------------------------------- */

/**
 * Price a cart and resolve it against the live menu.
 * Returns { lines, subtotal, discount, promoCode, promoError, deliveryFee, total }
 */
export function priceCart(db, rawLines, { type, promoCode }) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) throw new PriceError('Your bag is empty')
  if (rawLines.length > 40) throw new PriceError('Too many different items in one order')
  if (!['delivery', 'pickup'].includes(type)) throw new PriceError('Choose delivery or pickup')

  const settings = readSettings(db)
  const ids = [...new Set(rawLines.map((l) => String(l.itemId)))]
  const ph = ids.map(() => '?').join(',')
  const items = db.prepare(`SELECT * FROM menu_items WHERE id IN (${ph})`).all(...ids)
  const byId = new Map(items.map((i) => [i.id, i]))
  const groups = groupsFor(db, ids)

  const lines = []
  let subtotal = 0

  for (const raw of rawLines) {
    const item = byId.get(String(raw.itemId))
    if (!item) throw new PriceError('An item in your bag is no longer on the menu')
    if (!item.available) throw new PriceError(`${item.name} is sold out right now`)

    const qty = Number(raw.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new PriceError(`Invalid quantity for ${item.name}`)

    const choiceIds = Array.isArray(raw.choices) ? raw.choices.map(Number) : []
    const gs = groups.get(item.id) || []
    const { unit, byGroup } = unitPrice(item, gs, choiceIds)

    const optLabel = [...byGroup.values()]
      .flatMap((x) => x.choices.map((c) => c.label))
      .join(', ')

    subtotal += unit * qty
    lines.push({
      itemId: item.id, name: item.name, img: item.img, price: unit, qty,
      opts: optLabel, note: String(raw.note || '').slice(0, 200),
    })
  }

  const promoRow = promoCode ? db.prepare('SELECT * FROM promos WHERE UPPER(code) = UPPER(?)').get(String(promoCode).trim()) : null
  const { promo, discount, error } = applyPromo(promoRow ? S.promo(promoRow) : null, subtotal)

  const fee = deliveryFee({ type, subtotal, settings })
  const tax = settings.taxPct ? Math.round(((subtotal - discount) * settings.taxPct) / 100) : 0
  const total = Math.max(0, subtotal - discount + fee + tax)

  return {
    lines,
    subtotal,
    discount,
    promoCode: promo?.code ?? null,
    promoError: promoCode ? error : null,
    deliveryFee: fee,
    tax,
    total,
    settings,
  }
}

export function createOrder(db, { type, lines, customer, payMethod = 'cod', note = '',
  promoCode = null, channel = 'web', customerId = null }) {
  const priced = priceCart(db, lines, { type, promoCode })

  if (priced.settings.acceptingOrders === false) throw new PriceError('We are not accepting new orders right now', 409)
  if (priced.subtotal < (priced.settings.minOrder || 0)) {
    throw new PriceError(`Minimum order is Rs ${Number(priced.settings.minOrder).toLocaleString('en-PK')}`, 409)
  }

  const t = now()

  db.exec('BEGIN IMMEDIATE')
  let id
  try {
    id = nextId(db)

    let validCustomerId = null
    if (customerId) {
      const cust = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId)
      if (cust) {
        validCustomerId = cust.id
      } else if (customer?.name && customer?.phone) {
        validCustomerId = customerId
        db.prepare(`INSERT INTO customers(id,name,phone,email,address,note,pass_hash,points,created_at)
          VALUES(?,?,?,?,?,?,NULL,0,?)`
        ).run(customerId, customer.name, customer.phone, '', customer.address || '', '', t)
      }
    }

    db.prepare(`INSERT INTO orders
      (id,customer_id,rider_id,type,status,subtotal,delivery_fee,discount,total,promo_code,
       pay_method,pay_status,note,channel,created_at)
      VALUES(?,?,NULL,?,'new',?,?,?,?,?,?,'unpaid',?,?,?)`).run(
      id, validCustomerId, type, priced.subtotal, priced.deliveryFee, priced.discount,
      priced.total, priced.promoCode, payMethod, note.slice(0, 500), channel, t,
    )

    db.prepare('INSERT INTO order_customers(order_id,name,phone,address) VALUES(?,?,?,?)').run(
      id, customer.name, customer.phone, customer.address || '',
    )

    const insItem = db.prepare(
      'INSERT INTO order_items(order_id,item_id,name,img,price,qty,opts,note) VALUES(?,?,?,?,?,?,?,?)')
    for (const l of priced.lines) {
      insItem.run(id, l.itemId, l.name, l.img || '', l.price, l.qty, l.opts || '', l.note || '')
    }

    db.prepare('INSERT INTO order_events(order_id,status,at,actor) VALUES(?,?,?,?)')
      .run(id, 'new', t, channel)

    if (priced.promoCode) {
      db.prepare('UPDATE promos SET uses = uses + 1 WHERE UPPER(code) = UPPER(?)').run(priced.promoCode)
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }

  const order = getOrder(db, id)
  broadcast('order.created', order)
  return order
}

function nextId(db) {
  const row = db.prepare("SELECT v FROM counters WHERE k = 'order'").get()
  const next = (row?.v ?? 1040) + 1
  db.prepare("INSERT INTO counters(k,v) VALUES('order',?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(next)
  return `FZ-${next}`
}

export function getOrder(db, id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
  if (!o) return null
  const cust = db.prepare('SELECT * FROM order_customers WHERE order_id = ?').get(id) || {}
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id)
  const events = db.prepare('SELECT status, at FROM order_events WHERE order_id = ? ORDER BY at, id').all(id)
  const rider = o.rider_id ? db.prepare('SELECT * FROM riders WHERE id = ?').get(o.rider_id) : null

  return {
    id: o.id,
    type: o.type,
    status: o.status,
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    discount: o.discount,
    total: o.total,
    promoCode: o.promo_code,
    payMethod: o.pay_method,
    payStatus: o.pay_status,
    note: o.note,
    cancelReason: o.cancel_reason,
    rating: o.rating,
    channel: o.channel,
    createdAt: o.created_at,
    customer: { name: cust.name || '', phone: cust.phone || '', address: cust.address || '' },
    items: items.map((i) => ({
      itemId: i.item_id, name: i.name, img: i.img, price: i.price, qty: i.qty,
      opts: i.opts, note: i.note,
    })),
    timeline: events,
    rider: rider ? { id: rider.id, name: rider.name, phone: rider.phone, bike: rider.bike } : null,
    nextStatus: nextStatusFor(o),
    // Plain-language progress for the customer, so nobody has to read status
    // codes: 1 of 4 = accepted, 4 of 4 = done. Pickup skips the ride.
    progress: progressFor(o.status, o.type),
  }
}

/** Human-facing step for the customer tracker. */
export function progressFor(status, type) {
  const steps = type === 'pickup'
    ? ['new', 'preparing', 'ready', 'delivered']
    : ['new', 'preparing', 'out', 'delivered']
  if (status === 'cancelled') return { step: 0, total: steps.length, label: 'Cancelled' }
  const labels = {
    new: 'Order received',
    preparing: 'In the kitchen',
    ready: type === 'pickup' ? 'Ready to collect' : 'Packed, waiting for a rider',
    out: 'On the way to you',
    delivered: type === 'pickup' ? 'Collected' : 'Delivered',
  }
  // 'ready' sits between preparing and out on deliveries; treat it as step 2.5
  let idx = steps.indexOf(status)
  if (idx === -1) idx = status === 'ready' ? 1 : 0
  return { step: idx + 1, total: steps.length, label: labels[status] || status }
}

export function listOrders(db, { status, type, q, limit = 100, since, channel } = {}) {
  const where = []
  const args = []
  if (status) {
    const list = String(status).split(',').filter(Boolean)
    where.push(`o.status IN (${list.map(() => '?').join(',')})`)
    args.push(...list)
  }
  if (type) { where.push('o.type = ?'); args.push(type) }
  if (channel) { where.push('o.channel = ?'); args.push(channel) }
  if (since) { where.push('o.created_at >= ?'); args.push(Number(since)) }
  if (q) {
    where.push('(o.id LIKE ? OR oc.name LIKE ? OR oc.phone LIKE ?)')
    const like = `%${q}%`
    args.push(like, like, like)
  }
  const sql = `SELECT o.id FROM orders o
    LEFT JOIN order_customers oc ON oc.order_id = o.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY o.created_at DESC LIMIT ?`
  const rows = db.prepare(sql).all(...args, Math.min(Number(limit) || 100, 500))
  return rows.map((r) => getOrder(db, r.id))
}

export function setOrderStatus(db, id, status, actor = 'staff', extra = {}) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
  if (!o) return { error: 'Order not found', status: 404 }
  if (o.status === 'delivered' || o.status === 'cancelled') {
    return { error: `Order is already ${o.status}`, status: 409 }
  }
  if (status === 'cancelled') {
    db.prepare('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?')
      .run(status, String(extra.reason || '').slice(0, 300), id)
  } else {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id)
  }
  db.prepare('INSERT INTO order_events(order_id,status,at,actor) VALUES(?,?,?,?)')
    .run(id, status, now(), actor)

  // Freeing the rider needs no write: availability is derived from the order
  // status, so once this order leaves new/preparing/ready/out the rider is
  // available again automatically.
  if (status === 'delivered' && extra.creditPoints !== false) {
    db.prepare('UPDATE customers SET points = points + ? WHERE id = (SELECT customer_id FROM orders WHERE id = ?)')
      .run(pointsEarned(o.total), id)
  }
  const order = getOrder(db, id)
  broadcast('order.updated', order)
  return { order }
}

export function assignRider(db, id, riderId, actor = 'staff') {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
  if (!o) return { error: 'Order not found', status: 404 }
  if (o.status === 'delivered' || o.status === 'cancelled') {
    return { error: `Order is already ${o.status}`, status: 409 }
  }

  if (riderId) {
    const rider = db.prepare('SELECT * FROM riders WHERE id = ?').get(riderId)
    if (!rider) return { error: 'Rider not found', status: 404 }
    if (!rider.active) return { error: `${rider.name} is not on the roster`, status: 409 }

    // One run at a time: the rider must be free, or already on this order.
    const carrying = db.prepare(`
      SELECT id FROM orders
      WHERE rider_id = ? AND status IN ('new','preparing','ready','out') AND id <> ?
      LIMIT 1
    `).get(riderId, id)
    if (carrying) {
      return {
        error: `${rider.name} is already out on ${carrying.id}. Mark that order delivered first.`,
        status: 409,
      }
    }
  }

  db.prepare('UPDATE orders SET rider_id = ? WHERE id = ?').run(riderId || null, id)
  db.prepare('INSERT INTO order_events(order_id,status,at,actor) VALUES(?,?,?,?)')
    .run(id, o.status, now(), riderId ? `${actor} · rider assigned` : `${actor} · rider removed`)
  const order = getOrder(db, id)
  broadcast('order.updated', order)
  return { order }
}

export function rateOrder(db, id, rating, body = '', name = 'Customer') {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id)
  if (!o) return { error: 'Order not found', status: 404 }
  if (o.status !== 'delivered') return { error: 'You can rate an order once it has been delivered', status: 409 }
  if (o.rating) return { error: 'This order has already been rated', status: 409 }
  db.prepare('UPDATE orders SET rating = ? WHERE id = ?').run(rating, id)
  if (body && body.trim()) {
    db.prepare('INSERT INTO reviews(id,customer_id,order_id,name,rating,body,approved,created_at) VALUES(?,?,?,?,?,?,0,?)')
      .run('rv_' + Math.random().toString(36).slice(2, 10), o.customer_id, id, name, rating, body.trim().slice(0, 800), now())
  }
  return { ok: true }
}

export function findOrdersByPhone(db, phone) {
  const rows = db.prepare('SELECT order_id AS id FROM order_customers WHERE phone = ? ORDER BY order_id DESC').all(phone)
  return rows.map((r) => getOrder(db, r.id)).filter(Boolean)
}

/* ----------------------------- reservations ----------------------------- */

export function createReservation(db, r) {
  const id = 'T-' + Math.random().toString(36).slice(2, 8).toUpperCase()
  db.prepare('INSERT INTO reservations(id,name,phone,guests,at_day,at_time,note,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(id, r.name, r.phone, r.guests, r.day, r.time, r.note || '', 'pending', now())
  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id)
  broadcast('reservation.created', S.reservation(row))
  return S.reservation(row)
}

export function listReservations(db, { day, status } = {}) {
  const where = []
  const args = []
  if (day) { where.push('at_day = ?'); args.push(day) }
  if (status) { where.push('status = ?'); args.push(status) }
  return db.prepare(`SELECT * FROM reservations ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY at_day, at_time`)
    .all(...args).map(S.reservation)
}

export function setReservationStatus(db, id, status) {
  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id)
  if (!row) return null
  db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(status, id)
  const updated = S.reservation(db.prepare('SELECT * FROM reservations WHERE id = ?').get(id))
  broadcast('reservation.updated', updated)
  return updated
}

/** Table capacity guard: the family hall seats 40 across a sitting. */
const SEATS_PER_SLOT = 40
export function slotCapacity(db, day, time) {
  const row = db.prepare(
    `SELECT COALESCE(SUM(guests),0) AS n FROM reservations
     WHERE at_day = ? AND at_time = ? AND status IN ('pending','confirmed','seated')`,
  ).get(day, time)
  return { booked: row.n, capacity: SEATS_PER_SLOT, available: Math.max(0, SEATS_PER_SLOT - row.n) }
}

/* -------------------------------- riders -------------------------------- */

/**
 * Riders, each with the delivery they are currently carrying.
 *
 * A rider is "busy" from the moment they are assigned to a delivery until that
 * order is delivered or cancelled. The order board uses this to stop the same
 * rider being handed two runs at once.
 */
export function listRiders(db) {
  const riders = db.prepare('SELECT * FROM riders ORDER BY name').all().map(S.rider)
  const active = db.prepare(`
    SELECT id, rider_id, status FROM orders
    WHERE rider_id IS NOT NULL AND status IN ('new','preparing','ready','out')
  `).all()
  const busy = new Map(active.map((o) => [o.rider_id, o]))
  return riders.map((r) => ({
    ...r,
    busy: busy.has(r.id),
    currentOrder: busy.get(r.id)?.id || null,
  }))
}

export function upsertRider(db, r) {
  const row = db.prepare('SELECT id FROM riders WHERE id = ?').get(r.id)
  if (row) {
    db.prepare('UPDATE riders SET name=?,phone=?,bike=?,active=?,on_shift=? WHERE id=?')
      .run(r.name, r.phone || '', r.bike || '', r.active ? 1 : 0, r.onShift ? 1 : 0, r.id)
  } else {
    db.prepare('INSERT INTO riders(id,name,phone,bike,active,on_shift) VALUES(?,?,?,?,?,?)')
      .run(r.id, r.name, r.phone || '', r.bike || '', r.active === false ? 0 : 1, r.onShift ? 1 : 0)
  }
  return S.rider(db.prepare('SELECT * FROM riders WHERE id = ?').get(r.id))
}

export function deleteRider(db, id) {
  const rider = db.prepare('SELECT id, name FROM riders WHERE id = ?').get(id)
  if (!rider) return false

  // Cannot delete a rider who is currently on an active run
  const carrying = db.prepare(`
    SELECT id FROM orders
    WHERE rider_id = ? AND status IN ('new','preparing','ready','out')
    LIMIT 1
  `).get(id)
  if (carrying) {
    const err = new Error(`Cannot remove ${rider.name}: assigned to active order ${carrying.id}. Deliver or reassign it first.`)
    err.status = 409
    throw err
  }

  db.prepare('DELETE FROM riders WHERE id = ?').run(id)
  return true
}

/* ------------------------------- customers ------------------------------ */

export function findCustomerByPhone(db, phone) {
  return db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone) || null
}

export function upsertCustomer(db, c) {
  const existing = db.prepare('SELECT * FROM customers WHERE phone = ?').get(c.phone)
  if (existing) {
    db.prepare('UPDATE customers SET name = COALESCE(NULLIF(?, \'\'), name), address = COALESCE(NULLIF(?, \'\'), address) WHERE id = ?')
      .run(c.name || '', c.address || '', existing.id)
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id)
  }
  const id = 'c_' + Math.random().toString(36).slice(2, 10)
  db.prepare('INSERT INTO customers(id,name,phone,email,address,note,pass_hash,points,created_at) VALUES(?,?,?,?,?,?,NULL,0,?)')
    .run(id, c.name || 'Guest', c.phone, c.email || null, c.address || '', '', now())
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
}

export function listCustomers(db, { q } = {}) {
  const args = []
  let where = ''
  if (q) {
    where = 'WHERE c.name LIKE ? OR c.phone LIKE ?'
    args.push(`%${q}%`, `%${q}%`)
  }
  const rows = db.prepare(`
    SELECT c.*,
      COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) AS orders,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total ELSE 0 END), 0) AS spent,
      MAX(CASE WHEN o.status = 'delivered' THEN o.created_at ELSE NULL END) AS last_order_at
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    ${where}
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT 500
  `).all(...args)

  return rows.map((r) => ({
    ...S.customer(r),
    orders: r.orders || 0,
    spent: r.spent || 0,
    lastOrderAt: r.last_order_at || null,
  }))
}

/* -------------------------------- reviews ------------------------------- */

export function listReviews(db, { approvedOnly = true } = {}) {
  const where = approvedOnly ? 'WHERE approved = 1' : ''
  return db.prepare(`SELECT * FROM reviews ${where} ORDER BY created_at DESC LIMIT 200`).all().map(S.review)
}

export function reviewSummary(db) {
  const r = db.prepare('SELECT COUNT(*) AS n, COALESCE(AVG(rating),0) AS avg FROM reviews WHERE approved = 1').get()
  return { count: r.n, average: Math.round(r.avg * 10) / 10 }
}

export function createReview(db, r) {
  const id = 'rv_' + Math.random().toString(36).slice(2, 10)
  db.prepare('INSERT INTO reviews(id,customer_id,order_id,name,rating,body,approved,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, r.customerId || null, r.orderId || null, r.name, r.rating, String(r.body || '').slice(0, 800), r.approved ? 1 : 0, now())
  return S.review(db.prepare('SELECT * FROM reviews WHERE id = ?').get(id))
}

export function setReviewApproved(db, id, approved) {
  db.prepare('UPDATE reviews SET approved = ? WHERE id = ?').run(approved ? 1 : 0, id)
  const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id)
  return row ? S.review(row) : null
}

/* -------------------------------- reports ------------------------------- */

export function dashboardStats(db) {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const today = startOfToday.getTime()
  const week = today - 6 * 86400000

  const q = (sql, ...a) => db.prepare(sql).get(...a)

  const todayAgg = q(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
    FROM orders WHERE status = 'delivered' AND created_at >= ?`, today)
  const weekAgg = q(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
    FROM orders WHERE status = 'delivered' AND created_at >= ?`, week)
  const live = q(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('new','preparing','ready','out')`)
  const avg = q(`SELECT COALESCE(AVG(total),0) AS a FROM orders WHERE status='delivered' AND created_at >= ?`, week)
  const rating = q(`SELECT COALESCE(AVG(rating),0) AS a, COUNT(*) AS n FROM orders WHERE rating IS NOT NULL`)

  const byStatus = db.prepare(`SELECT status, COUNT(*) AS n FROM orders
    WHERE created_at >= ? GROUP BY status`).all(week)

  const topItems = db.prepare(`SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.price) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.created_at >= ? AND o.status != 'cancelled'
    GROUP BY oi.item_id, oi.name ORDER BY qty DESC LIMIT 8`).all(week)

  const daily = db.prepare(`SELECT date(created_at/1000,'unixepoch','localtime') AS day,
      COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
    FROM orders WHERE status='delivered' AND created_at >= ?
    GROUP BY day ORDER BY day`).all(week - 7 * 86400000)

  const hourly = db.prepare(`SELECT CAST(strftime('%H', created_at/1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
      COUNT(*) AS orders FROM orders WHERE created_at >= ? GROUP BY hour ORDER BY hour`).all(week)

  return {
    today: { orders: todayAgg.orders, revenue: todayAgg.revenue },
    week: { orders: weekAgg.orders, revenue: weekAgg.revenue, avgOrder: Math.round(avg.a) },
    liveOrders: live.n,
    rating: { average: Math.round(rating.a * 10) / 10, count: rating.n },
    byStatus,
    topItems,
    daily,
    hourly,
  }
}

/* ------------------------------ activity log ---------------------------- */

export function recentActivity(db, limit = 12) {
  const rows = db.prepare(`SELECT e.order_id, e.status, e.at, oc.name
    FROM order_events e LEFT JOIN order_customers oc ON oc.order_id = e.order_id
    ORDER BY e.at DESC LIMIT ?`).all(limit)
  return rows
}
