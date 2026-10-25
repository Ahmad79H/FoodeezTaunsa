/** Admin-only helpers layered on top of the shared formatting utils. */
export * from './utils.js'

/** Human label for the next action on an order. */
export function nextLabel(order) {
  if (!order?.nextStatus) return null
  if (order.nextStatus === 'delivered' && order.type === 'pickup') return 'Collected'
  return {
    preparing: 'Accept & cook',
    ready: 'Mark ready',
    out: 'Send with rider',
    delivered: 'Delivered',
  }[order.nextStatus] || 'Next step'
}

/**
 * One sentence telling staff what to do next, so nobody has to decode the
 * status machine. Empty string when there is nothing to do.
 */
export function nextHint(order) {
  if (!order) return ''
  if (order.status === 'delivered') return 'Done — the customer has been notified.'
  if (order.status === 'cancelled') return 'Cancelled.'
  if (order.type === 'pickup') {
    return {
      new: 'Accept it, then it moves to the kitchen.',
      preparing: 'Cooking. Mark ready when it is packed.',
      ready: 'Waiting at the counter for pickup.',
    }[order.status] || ''
  }
  return {
    new: 'Accept it to start cooking.',
    preparing: 'Cooking. Mark ready when it is packed.',
    ready: order.rider ? `${order.rider.name} can take it — mark it out.` : 'Assign a rider, then send it out.',
    out: order.rider ? `${order.rider.name} is on the way.` : 'On the way. Mark delivered when it lands.',
  }[order.status] || ''
}
