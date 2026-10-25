/** Row -> API shape converters. Booleans are 0/1 in SQLite. */

export const bool = (v) => v === 1 || v === true || v === '1'
export const num = (v) => (v == null ? null : Number(v))
export const json = (v, fallback) => {
  if (v == null) return fallback
  try { return JSON.parse(v) } catch { return fallback }
}

export function category(row) {
  return { id: row.id, name: row.name, ur: row.ur, sort: row.sort }
}

/**
 * @param {{item:object, groups:Array}} bundle
 */
export function menuItem({ item, groups, images }) {
  // `img` is the cover and must stay populated for older call sites.
  const gallery = images?.length ? images : item.img ? [item.img] : []
  return {
    id: item.id,
    cat: item.cat,
    name: item.name,
    desc: item.descr,
    price: item.price,
    was: item.was ?? null,
    img: gallery[0] || item.img,
    images: gallery,
    tags: json(item.tags, []),
    serves: item.serves ?? null,
    available: bool(item.available),
    featured: bool(item.featured),
    spice: item.spice || 0,
    veg: bool(item.veg),
    prepMins: item.prep_mins,
    opts: groups.map((g) => ({
      id: g.id,
      group: g.label,
      required: bool(g.required),
      multi: bool(g.multi),
      choices: g.choices.map((c) => ({ id: c.id, n: c.label, p: c.delta })),
    })),
  }
}

export function promo(row) {
  if (!row) return null
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    min: row.min,
    active: bool(row.active),
    uses: row.uses,
    cap: row.cap ?? null,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
  }
}

export function reservation(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    guests: row.guests,
    day: row.at_day,
    time: row.at_time,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function review(row) {
  return {
    id: row.id,
    name: row.name,
    rating: row.rating,
    body: row.body,
    approved: bool(row.approved),
    createdAt: row.created_at,
  }
}

export function rider(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    bike: row.bike,
    active: bool(row.active),
    onShift: bool(row.on_shift),
  }
}

export function customer(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    address: row.address || '',
    note: row.note || '',
    points: row.points,
    hasAccount: !!row.pass_hash,
    createdAt: row.created_at,
  }
}
