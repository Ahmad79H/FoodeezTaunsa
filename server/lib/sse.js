/**
 * Server-Sent Events hub.
 *
 * Orders, reservations and the kitchen board all subscribe to one channel.
 * SSE is used instead of WebSockets because it survives serverless/edge and
 * any reverse proxy (nginx, Caddy, Cloudflare) with no extra configuration —
 * which matters when this moves off the demo host onto the restaurant's own
 * domain.
 */

let seq = 0
const clients = new Map()

export function addClient(res, scope = '*') {
  const id = ++seq
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(': connected\n\n')
  clients.set(id, { res, scope })

  const ping = setInterval(() => {
    try { res.write(': ping\n\n') } catch { cleanup(id, ping) }
  }, 25000)

  res.on('close', () => cleanup(id, ping))
  return id
}

function cleanup(id, ping) {
  clearInterval(ping)
  const c = clients.get(id)
  if (c) { try { c.res.end() } catch {} }
  clients.delete(id)
}

/**
 * @param {string} event  e.g. 'order.created'
 * @param {object} data
 * @param {string} scope  '*' for everyone, or a room name like 'kitchen'
 */
export function broadcast(event, data, scope = '*') {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const { res, scope: s } of clients.values()) {
    if (scope !== '*' && s !== '*' && s !== scope) continue
    try { res.write(frame) } catch { /* client vanished; close handler cleans up */ }
  }
}

export function clientCount() {
  return clients.size
}
