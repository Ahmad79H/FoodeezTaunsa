/** Thin fetch wrapper around the Foodeez API. */

const BASE = '/api'

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'same-origin',
    signal,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data = {}
  if (text) {
    try { data = JSON.parse(text) } catch { data = { error: text.slice(0, 200) } }
  }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

/**
 * Upload dish photos. The browser sets the multipart boundary itself, so no
 * Content-Type header here — passing one would break the parse on the server.
 */
export async function uploadPhotos(files) {
  const fd = new FormData()
  for (const f of files) fd.append('files', f)

  const res = await fetch(BASE + '/admin/uploads', {
    method: 'POST',
    credentials: 'same-origin',
    body: fd,
  })

  const text = await res.text()
  let data = {}
  if (text) {
    try { data = JSON.parse(text) } catch { data = { error: text.slice(0, 200) } }
  }
  if (!res.ok) {
    const err = new Error(data.error || `Upload failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data.files || []
}

export const api = {
  get: (p, o) => request(p, o),
  post: (p, body, o) => request(p, { ...o, method: 'POST', body }),
  patch: (p, body, o) => request(p, { ...o, method: 'PATCH', body }),
  put: (p, body, o) => request(p, { ...o, method: 'PUT', body }),
  del: (p, o) => request(p, { ...o, method: 'DELETE' }),
}

/** Subscribe to the server event stream. Returns an unsubscribe function. */
export function connectEvents(onEvent, { scope } = {}) {
  const url = BASE + '/events' + (scope ? `?scope=${encodeURIComponent(scope)}` : '')

  let es = null
  let closed = false
  let retries = 0
  let timer = null

  const types = ['order.created', 'order.updated', 'reservation.created', 'reservation.updated']

  const connect = () => {
    if (closed) return
    timer = null
    try {
      es = new EventSource(url, { withCredentials: true })
    } catch {
      scheduleReconnect()
      return
    }

    for (const t of types) {
      es.addEventListener(t, (e) => {
        try { onEvent(t, JSON.parse(e.data)) } catch { /* ignore malformed frame */ }
      })
    }

    // Re-establish the stream automatically when the connection drops. This
    // can happen with proxies, laptop sleep/wake and serverless timeouts.
    let openedAt = 0
    es.onopen = () => {
      openedAt = Date.now()
      retries = 0
    }
    es.onerror = () => {
      es?.close()
      if (Date.now() - openedAt > 5000) retries = 0
      if (!timer) scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (closed || timer) return
    const delay = Math.min(1000 + retries * 500, 3000)
    retries += 1
    timer = setTimeout(connect, delay)
  }

  connect()

  return () => {
    closed = true
    if (timer) clearTimeout(timer)
    es?.close()
  }
}
