/**
 * Pricing.
 *
 * The client only ever sends *what* was chosen — item ids, option ids and
 * quantities. Every rupee is computed here from the database. A tampered
 * request cannot change a price.
 *
 * Money is integer rupees throughout.
 */

export class PriceError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

/**
 * Option semantics (see server/db/seed.js):
 *   - required group  -> choice.delta is the ABSOLUTE price of that variant
 *                        (e.g. pizza Small 650 / Medium 1150 / Large 1650)
 *   - optional group  -> choice.delta is ADDED to the base price
 *                        (e.g. extra cheese +80)
 */
export function unitPrice(item, groups, chosenChoiceIds) {
  let unit = item.price
  const byGroup = new Map()
  for (const g of groups) byGroup.set(g.id, { group: g, choices: [] })

  for (const g of groups) {
    const picked = g.choices.filter((c) => chosenChoiceIds.includes(c.id))
    if (g.required && picked.length === 0) {
      throw new PriceError(`${item.name}: please choose a ${g.label.toLowerCase()}`)
    }
    if (g.required && picked.length > 1) {
      throw new PriceError(`${item.name}: only one ${g.label.toLowerCase()} can be selected`)
    }
    for (const c of picked) {
      // A required option with a positive price replaces the base price.
      unit = g.required ? (c.delta > 0 ? c.delta : item.price) : unit + c.delta
      byGroup.get(g.id).choices.push(c)
    }
  }

  const unknown = chosenChoiceIds.filter((id) => !groups.some((g) => g.choices.some((c) => c.id === id)))
  if (unknown.length) throw new PriceError('One of the selected options is no longer available')

  return { unit, byGroup }
}

/**
 * Validate a promo code against a subtotal.
 * @returns {{ promo: object|null, discount: number, error: string|null }}
 */
export function applyPromo(promo, subtotal, nowMs = Date.now()) {
  if (!promo) return { promo: null, discount: 0, error: 'Code not valid' }
  if (!promo.active) return { promo: null, discount: 0, error: 'Code not valid' }
  if (promo.starts_at && nowMs < promo.starts_at) return { promo: null, discount: 0, error: 'Code not active yet' }
  if (promo.ends_at && nowMs > promo.ends_at) return { promo: null, discount: 0, error: 'Code has expired' }
  if (promo.cap != null && promo.uses >= promo.cap) return { promo: null, discount: 0, error: 'Code fully redeemed' }
  if (subtotal < promo.min) {
    return { promo: null, discount: 0, error: `Add Rs ${(promo.min - subtotal).toLocaleString('en-PK')} more to use ${promo.code}` }
  }
  const raw = promo.type === 'pct' ? Math.round((subtotal * promo.value) / 100) : promo.value
  const discount = Math.max(0, Math.min(raw, subtotal))
  return { promo, discount, error: null }
}

/** Delivery fee rules, in one place so the cart and the order always agree. */
export function deliveryFee({ type, subtotal, settings }) {
  if (type === 'pickup') return 0
  if (subtotal <= 0) return 0
  if (subtotal >= settings.freeDeliveryOver) return 0
  return settings.deliveryFee || 0
}

/** Loyalty: 1 point per Rs 100 actually paid, capped so it cannot runaway. */
export function pointsEarned(total) {
  return Math.min(500, Math.floor(total / 100))
}

/** Ordered status machine. Pickup skips the 'out' leg. */
export const NEXT_STATUS = {
  new: 'preparing',
  preparing: 'ready',
  ready: 'out',
  out: 'delivered',
}

export function nextStatusFor(order) {
  if (order.status === 'ready' && order.type === 'pickup') return 'delivered'
  return NEXT_STATUS[order.status] || null
}
