import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, Spinner, Empty, Modal, Field } from '../ui.jsx'
import { cn } from '../lib/utils.js'
import { api, connectEvents } from '../lib/api.js'
import { asset, rs, clock, minsAgo, STATUS_SHORT, STATUS_LABEL, PAY_LABEL, nextLabel, nextHint, dayOptions } from '../lib/admin-utils.js'

/* ================================ ORDERS ================================ */

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'active', label: '🔥 Pipeline' },
  { id: 'new', label: 'New' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'out', label: 'Out' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function Orders() {
  const { toast } = useApp()
  const { search } = useRouter()
  const initialStatus = new URLSearchParams(search || '').get('status') || ''
  const [status, setStatus] = useState(initialStatus)
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [orders, setOrders] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [cachedOrder, setCachedOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (status === 'active') {
        params.set('status', 'new,preparing,ready,out')
      } else if (status) {
        params.set('status', status)
      }
      if (type) params.set('type', type)
      if (q.trim()) params.set('q', q.trim())
      params.set('limit', '120')
      const d = await api.get('/orders?' + params)
      setOrders(d.orders)
    } catch (e) { toast(e.message, 'err') } finally { setLoading(false) }
  }, [status, type, q, toast])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  // Fast 3.5s auto-polling ensures incoming orders appear instantly even if SSE is dropped
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    const timer = setInterval(() => loadRef.current(), 3500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const off = connectEvents(() => loadRef.current())
    return off
  }, [])

  useEffect(() => {
    if (openId) {
      const found = orders?.find((o) => o.id === openId)
      if (found) setCachedOrder(found)
    } else {
      setCachedOrder(null)
    }
  }, [openId, orders])

  const open = cachedOrder || orders?.find((o) => o.id === openId) || null

  return (
    <div className="page">
      <div className="toolbar">
        <div className="segs">
          {FILTERS.map((f) => (
            <button key={f.id} className={cn(status === f.id && 'on')} onClick={() => setStatus(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="sp" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="sel">
          <option value="">Delivery + pickup</option>
          <option value="delivery">Delivery</option>
          <option value="pickup">Pickup</option>
        </select>
        <label className="srch">
          <Icon name="search" size={15} />
          <input placeholder="Order, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button className="btn o sm" onClick={load}>Refresh</button>
      </div>

      {loading && !orders && <Spinner label="Loading orders…" />}

      {orders && orders.length === 0 && <Empty icon="box" title="No orders match">Try a different filter.</Empty>}

      {orders && orders.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Order</th><th>Placed</th><th>Customer</th><th>Items</th>
                <th>Type</th><th>Status</th><th className="right">Total</th><th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} onClick={() => setOpenId(o.id)} className="rowlink">
                  <td><b className="mono">{o.id}</b></td>
                  <td><span className="muted">{clock(o.createdAt)}</span><br /><small>{minsAgo(o.createdAt)}</small></td>
                  <td>{o.customer.name}<br /><small className="muted">{o.customer.phone}</small></td>
                  <td className="ellipsis">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</td>
                  <td><span className={cn('chip', o.type === 'pickup' ? 'c-pick' : 'c-del')}>{o.type}</span></td>
                  <td><span className={cn('chip', `st-${o.status}`)}>{STATUS_SHORT[o.status]}</span></td>
                  <td className="right"><b>{rs(o.total)}</b></td>
                  <td className="right"><Icon name="arrow" size={14} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OrderDrawer id={openId} order={open} onClose={() => setOpenId(null)} onChange={load} />
    </div>
  )
}

/* ----------------------------- order drawer ----------------------------- */

export function OrderDrawer({ id, order: orderProp, onClose, onChange }) {
  const { toast } = useApp()
  const [riders, setRiders] = useState([])
  const [busy, setBusy] = useState(false)
  const [order, setOrder] = useState(orderProp)

  useEffect(() => {
    if (orderProp) setOrder(orderProp)
  }, [orderProp])

  useEffect(() => {
    if (!id) return
    api.get('/admin/riders').then((d) => setRiders(d.riders.filter((r) => r.active))).catch(() => {})
  }, [id])

  if (!id || !order) return null

  const act = async (fn, success) => {
    setBusy(true)
    try {
      const res = await fn()
      if (res?.order) setOrder(res.order)
      toast(success || 'Updated')
      onChange?.()
    } catch (e) { toast(e.message, 'err') } finally { setBusy(false) }
  }

  const advance = () => {
    if (!order?.nextStatus) return
    const label = STATUS_SHORT[order.nextStatus]
    act(() => api.patch(`/orders/${order.id}/status`, { status: order.nextStatus }), `Moved to ${label}`)
  }

  const cancel = () => {
    const reason = prompt('Reason for cancelling?', 'Cancelled by staff')
    if (reason === null) return
    act(() => api.patch(`/orders/${order.id}/status`, { status: 'cancelled', reason }), 'Order cancelled')
  }

  const hint = nextHint(order)

  return (
    <Modal open={!!id} onClose={onClose} className="order-modal" labelledBy="od-title">
      <div className="om-head">
        <div>
          <h3 id="od-title" className="mono">{order.id}</h3>
          <p className="muted">
            {order.type === 'pickup' ? 'Pickup' : 'Delivery'} · placed {clock(order.createdAt)} · {minsAgo(order.createdAt)}
          </p>
        </div>
        <div className="om-head-right">
          <span className={cn('chip', `st-${order.status}`)}>{STATUS_SHORT[order.status]}</span>
          <button className="x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
      </div>

      <div className="om-body">
        <div className="om-cols">
          <div>
            <h5>Items</h5>
            <ul className="om-items">
              {order.items.map((i, k) => (
                <li key={k}>
                  <img src={asset(i.img)} alt="" />
                  <div>
                    <b>{i.qty}× {i.name}</b>
                    {i.opts && <small>{i.opts}</small>}
                    {i.note && <small className="line-note">“{i.note}”</small>}
                  </div>
                  <span>{rs(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>

            <div className="sum-list">
              <div className="sum"><span>Subtotal</span><span>{rs(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="sum disc"><span>Discount {order.promoCode}</span><span>− {rs(order.discount)}</span></div>}
              <div className="sum"><span>Delivery</span><span>{order.deliveryFee ? rs(order.deliveryFee) : 'Free'}</span></div>
              <div className="sum tot"><span>Total</span><span>{rs(order.total)}</span></div>
            </div>

            {order.note && <div className="om-note"><Icon name="message" size={13} /> {order.note}</div>}
          </div>

          <div>
            <h5>Customer</h5>
            <dl className="kv">
              <dt>Name</dt><dd>{order.customer.name}</dd>
              <dt>Phone</dt><dd><a href={`tel:${order.customer.phone.replace(/\s/g, '')}`}>{order.customer.phone}</a></dd>
              {order.type === 'delivery' && <><dt>Address</dt><dd>{order.customer.address}</dd></>}
              <dt>Payment</dt><dd>{PAY_LABEL[order.payMethod]} · {order.payStatus}</dd>
              <dt>Channel</dt><dd>{order.channel}</dd>
            </dl>

            {order.type === 'delivery' && (
              <>
                <h5>Rider</h5>
                <select
                  className="sel wide"
                  value={order.rider?.id || ''}
                  disabled={busy}
                  onChange={(e) => act(() => api.post(`/orders/${order.id}/assign`, { riderId: e.target.value || null }),
                    e.target.value ? 'Rider assigned' : 'Rider removed')}
                >
                  <option value="">Unassigned</option>
                  {riders.map((r) => (
                    <option
                      key={r.id}
                      value={r.id}
                      disabled={r.busy && r.currentOrder !== order.id}
                    >
                      {r.name} · {r.bike}
                      {r.busy ? (r.currentOrder === order.id ? ' (on this order)' : ` (out on ${r.currentOrder})`) : ' (free)'}
                    </option>
                  ))}
                </select>
                {riders.every((r) => r.busy && r.currentOrder !== order.id) && riders.length > 0 && (
                  <p className="hint">Every rider is out. Deliver or cancel one of their runs to free them up.</p>
                )}
              </>
            )}

            <h5>Timeline</h5>
            <ul className="om-timeline">
              {(order.timeline || []).map((e, k) => (
                <li key={k}>
                  <span className={cn('dot', `st-${e.status}`)} />
                  <b>{STATUS_LABEL[e.status] || e.status}</b>
                  <time>{clock(e.at)}</time>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {hint && <div className="om-hint"><Icon name="arrow" size={13} /> {hint}</div>}

      <div className="om-foot">
        {order.status !== 'delivered' && order.status !== 'cancelled' && (
          <>
            <button className="btn o sm" onClick={cancel} disabled={busy}>Cancel order</button>
            <div className="sp" />
            <button className="btn y" onClick={advance} disabled={busy || !order.nextStatus}>
              {busy ? 'Working…' : nextLabel(order) || 'Done'}
              <Icon name="arrow" size={15} />
            </button>
          </>
        )}
        {(order.status === 'delivered' || order.status === 'cancelled') && (
          <><span className="muted">This order is closed.</span><div className="sp" /><button className="btn o sm" onClick={onClose}>Close</button></>
        )}
      </div>
    </Modal>
  )
}

/* =============================== KITCHEN ================================ */

const KDS_COLS = [
  { id: 'new', label: 'New', next: 'Start cooking' },
  { id: 'preparing', label: 'Cooking', next: 'Mark ready' },
  { id: 'ready', label: 'Ready for hand off', next: 'Dispatch' },
  { id: 'out', label: 'Out with rider', next: 'Delivered' },
]

export function Kitchen() {
  const { toast } = useApp()
  const [orders, setOrders] = useState(null)
  const [sound, setSound] = useState(true)
  const audioCtx = useRef(null)

  const load = useCallback(async () => {
    try {
      const d = await api.get('/orders?status=new,preparing,ready,out&limit=80')
      setOrders(d.orders)
    } catch (e) { toast(e.message, 'err') }
  }, [toast])

  // Fast 3.5s auto-polling keeps kitchen tickets in sync instantly even if SSE is interrupted
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    load()
    const i = setInterval(() => loadRef.current(), 3500)
    return () => clearInterval(i)
  }, [load])

  useEffect(() => {
    const off = connectEvents((type) => {
      if (type === 'order.created') {
        if (sound) chime()
        loadRef.current()
      }
      if (type === 'order.updated') loadRef.current()
    })
    return off
  }, [sound])

  /* short two-tone chime, generated — no asset to ship or 404 */
  const chime = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      audioCtx.current ||= new Ctx()
      const ctx = audioCtx.current
      if (ctx.state === 'suspended') ctx.resume()
      ;[880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const t0 = ctx.currentTime + i * 0.16
        gain.gain.setValueAtTime(0.0001, t0)
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t0)
        osc.stop(t0 + 0.36)
      })
    } catch { /* audio is a nicety */ }
  }

  const advance = async (o) => {
    let next
    if (o.status === 'new') next = 'preparing'
    else if (o.status === 'preparing') next = 'ready'
    else if (o.status === 'ready') next = o.type === 'pickup' ? 'delivered' : 'out'
    else if (o.status === 'out') next = 'delivered'
    if (!next) return
    try {
      await api.patch(`/orders/${o.id}/status`, { status: next })
      toast(`${o.id} → ${STATUS_SHORT[next] || next}`)
      load()
    } catch (e) { toast(e.message, 'err') }
  }

  const grouped = useMemo(() => {
    const m = new Map(KDS_COLS.map((c) => [c.id, []]))
    for (const o of orders || []) m.get(o.status)?.push(o)
    return m
  }, [orders])

  return (
    <div className="kds">
      <div className="kds-bar">
        <div className="kds-legend">
          {(orders || []).length} active ticket{(orders || []).length === 1 ? '' : 's'}
        </div>
        <div className="sp" />
        <button className={cn('chipbtn', sound && 'on')} onClick={() => setSound((v) => !v)}>
          {sound ? '🔔 Sound on' : '🔕 Sound off'}
        </button>
        <button className="btn o sm" onClick={load}>Refresh</button>
      </div>

      {!orders && <Spinner label="Loading the pass…" />}

      <div className="kds-cols">
        {KDS_COLS.map((col) => (
          <div className="kds-col" key={col.id}>
            <header>
              <span className={cn('chip', `st-${col.id}`)}>{col.label}</span>
              <b>{grouped.get(col.id)?.length || 0}</b>
            </header>
            <div className="kds-list">
              {grouped.get(col.id)?.length === 0 && <div className="kds-empty">Nothing here</div>}
              {grouped.get(col.id)?.map((o) => (
                <article key={o.id} className={cn('ticket', o.type === 'pickup' && 'pickup')}>
                  <div className="t-head">
                    <b className="mono">{o.id}</b>
                    <span className="t-age">{minsAgo(o.createdAt)}</span>
                  </div>
                  <div className="t-meta">{o.type === 'pickup' ? 'Pickup' : 'Delivery'} · {o.customer.name}</div>
                  <ul className="t-items">
                    {o.items.map((i, k) => (
                      <li key={k}>
                        <b>{i.qty}×</b> {i.name}
                        {i.opts && <small>{i.opts}</small>}
                        {i.note && <small className="line-note">“{i.note}”</small>}
                      </li>
                    ))}
                  </ul>
                  <button className="btn y sm wide" onClick={() => advance(o)}>
                    {col.next} <Icon name="arrow" size={13} />
                  </button>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================= RESERVATIONS ============================= */

const RES_STATUS = {
  pending: 'Pending', confirmed: 'Confirmed', seated: 'Seated', cancelled: 'Cancelled', no_show: 'No show',
}

export function Reservations() {
  const { toast } = useApp()
  const [list, setList] = useState(null)
  const [day, setDay] = useState('')
  const [status, setStatus] = useState('')
  const days = useMemo(dayOptions, [])

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams()
      if (day) p.set('day', day)
      if (status) p.set('status', status)
      const d = await api.get('/admin/reservations?' + p)
      setList(d.reservations)
    } catch (e) { toast(e.message, 'err') }
  }, [day, status, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => connectEvents((t) => { if (t.startsWith('reservation.')) load() }), [load])

  const setRes = async (id, next) => {
    try {
      await api.patch(`/admin/reservations/${id}`, { status: next })
      toast(`Reservation ${RES_STATUS[next].toLowerCase()}`)
      load()
    } catch (e) { toast(e.message, 'err') }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <div className="segs">
          {[['', 'All'], ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['seated', 'Seated'], ['cancelled', 'Cancelled'], ['no_show', 'No show']].map(([id, label]) => (
            <button key={id} className={cn(status === id && 'on')} onClick={() => setStatus(id)}>{label}</button>
          ))}
        </div>
        <div className="sp" />
        <select className="sel" value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">Any day</option>
          {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <button className="btn o sm" onClick={load}>Refresh</button>
      </div>

      {!list && <Spinner label="Loading reservations…" />}
      {list?.length === 0 && <Empty icon="calendar" title="No reservations">Bookings from the website appear here instantly.</Empty>}

      {list?.length > 0 && (
        <div className="res-grid">
          {list.map((r) => (
            <article className={cn('res-card', `r-${r.status}`)} key={r.id}>
              <div className="rc-top">
                <b className="mono">{r.id}</b>
                <span className={cn('chip', `r-${r.status}`)}>{RES_STATUS[r.status]}</span>
              </div>
              <h4>{r.name}</h4>
              <p className="muted">{r.phone}</p>
              <div className="rc-when">
                <b>{r.day}</b>
                <span>{r.time}</span>
                <em>{r.guests} guests</em>
              </div>
              {r.note && <div className="rc-note">“{r.note}”</div>}
              <div className="rc-actions">
                {r.status === 'pending' && <button className="btn y sm" onClick={() => setRes(r.id, 'confirmed')}>Confirm</button>}
                {r.status === 'confirmed' && <button className="btn k sm" onClick={() => setRes(r.id, 'seated')}>Seated</button>}
                {['pending', 'confirmed'].includes(r.status) && (
                  <>
                    <button className="btn o sm" onClick={() => setRes(r.id, 'no_show')}>No show</button>
                    <button className="btn o sm" onClick={() => setRes(r.id, 'cancelled')}>Cancel</button>
                  </>
                )}
                {['seated', 'cancelled', 'no_show'].includes(r.status) && (
                  <button className="btn o sm" onClick={() => setRes(r.id, 'pending')}>Reopen</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
