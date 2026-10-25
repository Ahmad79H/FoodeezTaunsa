import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useRouter } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, Spinner, StarPicker, Empty } from '../ui.jsx'
import { api, connectEvents } from '../lib/api.js'
import { asset, cn, rs, clock, STATUS_LABEL, PAY_LABEL, etaMinutes } from '../lib/utils.js'

const FLOW = ['new', 'preparing', 'ready', 'out', 'delivered']
const COPY = {
  new: 'Waiting for Foodeez to accept your order.',
  preparing: 'Our kitchen is on it. Fresh, made-to-order.',
  ready: 'Packed and waiting for the rider.',
  out: 'Your rider is on the way.',
  delivered: 'Delivered. Enjoy your meal!',
}
const PICKUP_COPY = {
  ...COPY,
  ready: 'Hot and packed — come pick it up!',
  delivered: 'Collected. Enjoy!',
}

export default function Track({ id, search = '' }) {
  const { tickets, settings: s = {}, user, toast, menu, addToCart } = useApp()
  const { navigate } = useRouter()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [reviewBody, setReviewBody] = useState('')
  const [rated, setRated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  const urlToken = new URLSearchParams(search).get('t')
  const token = tickets[id] || urlToken

  const load = useCallback(async () => {
    try {
      const data = token
        ? await api.get(`/track/${id}/${token}`)
        : await api.get(`/orders/${id}`)
      setOrder(data.order)
      setError('')
    } catch (e) {
      setError(e.status === 404 ? 'We could not find that order.' : e.message)
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => { setLoading(true); load() }, [load])

  /* live updates over SSE — keep the current id in a ref so we always match
     the order the user is actually viewing, even if the component re-mounts
     or the id changes while the stream stays open. */
  const idRef = useRef(id)
  idRef.current = id
  useEffect(() => {
    const off = connectEvents((type, payload) => {
      if (type === 'order.updated' && payload?.id === idRef.current) setOrder(payload)
    })
    return off
  }, [])

  /* refresh the ETA every 30s */
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(i)
  }, [])

  /* poll as a fallback when the tab was asleep (SSE can drop on some hosts) */
  useEffect(() => {
    const i = setInterval(() => { if (document.visibilityState === 'visible') load() }, 45000)
    return () => clearInterval(i)
  }, [load])

  const steps = useMemo(() => {
    if (!order) return []
    const flow = order.type === 'pickup' ? FLOW.filter((x) => x !== 'out') : FLOW
    return flow.map((st) => ({
      id: st,
      at: order.timeline?.find((e) => e.status === st)?.at,
      label: st === 'delivered' && order.type === 'pickup' ? 'Collected' : STATUS_LABEL[st],
    }))
  }, [order])

  const idx = order ? steps.findIndex((x) => x.id === order.status) : -1
  const cancelled = order?.status === 'cancelled'
  const done = order?.status === 'delivered'
  const eta = etaMinutes(order, s.eta || 35)
  const copy = order?.type === 'pickup' ? PICKUP_COPY : COPY

  const cancel = async () => {
    if (!confirm('Cancel this order? This cannot be undone.')) return
    setBusy(true)
    try {
      const body = token ? { token, reason: 'Cancelled by customer' } : { reason: 'Cancelled by customer' }
      const { order: updated } = await api.post(`/orders/${id}/cancel`, body)
      setOrder(updated)
      toast('Order cancelled')
    } catch (e) {
      toast(e.message, 'err')
    } finally { setBusy(false) }
  }

  const submitRating = async () => {
    if (!rating) return toast('Pick a star rating first', 'err')
    try {
      await api.post(`/orders/${id}/rate`, { rating, body: reviewBody, token })
      setRated(true)
      toast('Thanks for the feedback!')
    } catch (e) { toast(e.message, 'err') }
  }

  const reorder = () => {
    if (!order) return
    let added = 0
    for (const line of order.items) {
      const found = menu.find((m) => m.id === line.itemId)
      if (!found || !found.available) continue
      const choices = (found.opts || []).filter((g) => g.required).map((g) => g.choices[0].id)
      addToCart(found, choices, line.qty)
      added++
    }
    if (!added) return toast('Those dishes are not available right now', 'err')
    navigate('/checkout')
  }

  if (loading) return <div className="wrap page-pad"><Spinner label="Loading your order…" /></div>
  if (error) {
    return (
      <div className="wrap page-pad">
        <Empty icon="alert" title={error} action={<Link to="/menu" className="btn y">Back to the menu</Link>}>
          If you placed this order, check the link in your confirmation or sign in to your account.
        </Empty>
      </div>
    )
  }

  return (
    <div className="track-page">
      <div className="ck-top">
        <div className="wrap">
          <Link to="/menu" className="roundbtn" aria-label="Back"><Icon name="back" size={18} /></Link>
          <div className="brand"><img src="/assets/logo.png" alt="" /><b>FOODEEZ</b></div>
          <div className="ck-steps"><span>Bag</span><span>›</span><span>Checkout</span><span>›</span><span className="on">Track</span></div>
        </div>
      </div>

      <div className="wrap track-grid">
        <div>
          <div className="track-hero">
            <video src="/assets/hero-sparks.mp4" autoPlay muted loop playsInline />
            <div className="oid">ORDER {order.id}</div>
            <h1 className="disp">
              {cancelled ? 'Order cancelled' : done ? 'Enjoy!' : order.status === 'new' ? 'Order placed' : STATUS_LABEL[order.status]}
            </h1>
            <p>{cancelled ? (order.cancelReason || 'This order was cancelled.') : copy[order.status]}</p>
            {!cancelled && !done && (
              <div className="eta"><b>{eta}</b><span>min<br />estimated</span></div>
            )}
            <div className="live-pill">
              <span className="status-dot" /> Live updates
            </div>
          </div>

          {!cancelled && (
            <ol className="tl">
              {steps.map((st, i) => (
                <li key={st.id} className={cn('tl-step', (i < idx || done) && 'done', i === idx && !done && 'cur')}>
                  <div className="dot">{i < idx || done ? <Icon name="check" size={13} stroke={3} /> : i + 1}</div>
                  <div className="tl-main">
                    <b>{st.label}</b>
                    <small>
                      {st.id === 'out' && order.rider && i <= idx
                        ? `${order.rider.name} · ${order.rider.phone} · ${order.rider.bike}`
                        : st.id === 'ready' && order.type === 'pickup'
                          ? 'Show your order number at the counter'
                          : st.id === 'delivered' ? 'Thank you for ordering' : ' '}
                    </small>
                  </div>
                  <time>{st.at ? clock(st.at) : ''}</time>
                </li>
              ))}
            </ol>
          )}

          <div className="track-actions">
            {!cancelled && !done && ['new', 'preparing'].includes(order.status) && (
              <button className="btn o sm" onClick={cancel} disabled={busy}>Cancel order</button>
            )}
            {cancelled && <Link to="/menu" className="btn y sm">Start a new order</Link>}
            <button className="btn k sm" onClick={reorder}>Order this again</button>
            <a className="btn o sm" href={`tel:${(s.phone1 || '').replace(/\s/g, '')}`}>
              <Icon name="phone" size={14} /> Call us
            </a>
          </div>

          {done && !order.rating && !rated && (
            <section className="blk rate-blk">
              <h4>How was it?</h4>
              <p>Your feedback helps the kitchen and the rest of Taunsa.</p>
              <StarPicker value={rating} onChange={setRating} />
              <textarea rows={2} placeholder="Tell us about the food (optional)" value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)} maxLength={600} />
              <button className="btn y sm" onClick={submitRating}>Send feedback</button>
            </section>
          )}
          {(rated || order.rating) && (
            <div className="rated-note"><Icon name="check" size={14} stroke={3} /> Thanks — your rating is in.</div>
          )}
        </div>

        <aside>
          <div className="blk receipt">
            <h4 className="sum-head">Your order</h4>
            {order.items.map((l, i) => (
              <div className="mini" key={i}>
                <img src={asset(l.img)} alt="" />
                <div>
                  <b>{l.qty}× {l.name}</b>
                  {l.opts && <small>{l.opts}</small>}
                  {l.note && <small className="line-note">“{l.note}”</small>}
                </div>
                <span>{rs(l.price * l.qty)}</span>
              </div>
            ))}

            <div className="sum-list">
              <div className="sum"><span>Subtotal</span><span>{rs(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="sum disc"><span>Discount {order.promoCode && `(${order.promoCode})`}</span><span>− {rs(order.discount)}</span></div>}
              <div className="sum"><span>{order.type === 'pickup' ? 'Pickup' : 'Delivery'}</span><span>{order.deliveryFee ? rs(order.deliveryFee) : 'Free'}</span></div>
              <div className="sum tot"><span>Total</span><span>{rs(order.total)}</span></div>
            </div>

            <dl className="kv">
              <dt>Name</dt><dd>{order.customer.name}</dd>
              <dt>Phone</dt><dd>{order.customer.phone}</dd>
              {order.type === 'delivery'
                ? <><dt>Address</dt><dd>{order.customer.address}</dd></>
                : <><dt>Pickup</dt><dd>{s.address}</dd></>}
              <dt>Payment</dt><dd>{PAY_LABEL[order.payMethod]} · {order.payStatus === 'paid' ? 'Paid' : 'Due'}</dd>
              <dt>Placed</dt><dd>{clock(order.createdAt)}</dd>
            </dl>

            {user?.role === 'customer' && (
              <Link to="/account" className="btn k wide" style={{ marginTop: 14 }}>All my orders</Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
