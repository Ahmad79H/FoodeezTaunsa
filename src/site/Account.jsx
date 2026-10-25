import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, Field, Spinner, Empty, Stars } from '../ui.jsx'
import { api, connectEvents } from '../lib/api.js'
import { cn, rs, clock, dayLabel, STATUS_SHORT, PAY_LABEL } from '../lib/utils.js'

/* ================================= AUTH ================================= */

export function Auth({ mode = 'login', search = '' }) {
  const { loginCustomer, registerCustomer, settings: s = {}, toast, user } = useApp()
  const { navigate, path } = useRouter()
  const isRegister = mode === 'register'

  const [form, setForm] = useState({ name: '', phone: '', password: '', address: '', email: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // ?next=/checkout sends them back to where they were headed after signing in.
  const next = new URLSearchParams(search || '').get('next')
  const afterAuth = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'

  useEffect(() => {
    if (user) navigate(afterAuth, { replace: true })
  }, [user, navigate, afterAuth])

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (isRegister) {
        if (form.name.trim().length < 2) throw new Error('Please enter your name')
        if (form.password.length < 8) throw new Error('Password must be at least 8 characters')
        await registerCustomer({
          name: form.name.trim(), phone: form.phone.trim(), password: form.password,
          email: form.email.trim() || undefined, address: form.address.trim() || undefined,
        })
        toast('Account created — welcome to Foodeez')
      } else {
        await loginCustomer(form.phone.trim(), form.password)
        toast('Signed in')
      }
      navigate(afterAuth, { replace: true })
    } catch (e2) {
      setErr(e2.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-brand">
          <img src="/assets/logo.png" alt="" />
          <b>FOODEEZ</b>
        </Link>
        <h1 className="disp">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">
          {isRegister
            ? 'Save your address, reorder in two taps and collect loyalty points.'
            : 'Sign in to see your orders, saved address and points.'}
        </p>

        <form onSubmit={submit}>
          {isRegister && (
            <Field label="Full name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" autoComplete="name" required />
            </Field>
          )}
          <Field label="Mobile number">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0333 1234567" inputMode="tel" autoComplete="tel" required />
          </Field>
          <Field label="Password" hint={isRegister ? 'At least 8 characters' : undefined}>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••" autoComplete={isRegister ? 'new-password' : 'current-password'} required />
          </Field>
          {isRegister && (
            <Field label="Delivery address (optional)">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House #, street, mohalla" autoComplete="street-address" />
            </Field>
          )}

          {err && <div className="warn">{err}</div>}

          <button className="btn y wide tall" disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New to Foodeez?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create one'}</Link>
        </p>
        <p className="auth-alt">
          Staff member? <a href="/admin">Open the admin panel</a>
        </p>
      </div>
    </div>
  )
}

/* ================================ ACCOUNT =============================== */

export function Account() {
  const { user, logout, refreshUser, toast, settings: s = {}, menu, menuById, addToCart } = useApp()
  const { navigate } = useRouter()
  const [orders, setOrders] = useState(null)
  const [tab, setTab] = useState('orders')
  const [profile, setProfile] = useState({ name: '', phone: '', address: '', email: '' })
  const [pw, setPw] = useState({ current: '', next: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setProfile({ name: user.name || '', phone: user.phone || '', address: user.address || '', email: user.email || '' })
  }, [user])

  const loadOrders = useCallback(() => {
    if (!user || user.role !== 'customer') return
    api.get('/orders/mine')
      .then((d) => setOrders(d.orders))
      .catch(() => setOrders([]))
  }, [user])

  useEffect(() => { loadOrders() }, [loadOrders])

  // Remember this customer's order ids so SSE events for other customers'
  // orders never trigger a pointless refetch.
  const ownIds = useRef(new Set())
  useEffect(() => {
    ownIds.current = new Set((orders || []).map((o) => o.id))
  }, [orders])

  // Status changes land here without a refresh, same stream the kitchen uses.
  // An order.updated for one of our orders is refetched right away; a remote
  // order.created has an unknown id, so those are throttled to one refetch per
  // second to stop a busy restaurant from flooding this page.
  const lastRefetch = useRef(0)
  useEffect(() => {
    if (!user || user.role !== 'customer') return
    const onEvent = (type, payload) => {
      if (type === 'order.updated' && payload?.id && !ownIds.current.has(payload.id)) return
      const nowMs = Date.now()
      if (nowMs - lastRefetch.current > 1000) {
        lastRefetch.current = nowMs
        loadOrders()
      }
    }
    return connectEvents(onEvent)
  }, [user, loadOrders])

  if (user === undefined) return <div className="wrap page-pad"><Spinner label="Loading…" /></div>

  if (!user) {
    return (
      <div className="wrap page-pad">
        <Empty icon="user" title="Sign in to see your account" action={<Link to="/login" className="btn y">Sign in</Link>}>
          Your orders, address and loyalty points live here.
        </Empty>
      </div>
    )
  }

  if (user.role !== 'customer') {
    return (
      <div className="wrap page-pad">
        <Empty icon="shield" title={`You are signed in as ${user.role}`} action={<a href="/admin" className="btn y">Go to the admin panel</a>}>
          This page is for customer accounts.
        </Empty>
      </div>
    )
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch('/auth/me', { name: profile.name, address: profile.address, email: profile.email })
      await refreshUser()
      toast('Profile updated')
    } catch (err) { toast(err.message, 'err') } finally { setBusy(false) }
  }

  /**
   * Put a past order back in the bag.
   *
   * The stored order only keeps a readable option label, not the choice ids, so
   * each line is re-added with the dish's default options — the same thing that
   * happens when you open the dish and tap "Add to bag". Anything sold out is
   * skipped rather than blocking the whole reorder.
   */
  const reorder = (order) => {
    let added = 0
    let skipped = 0
    for (const line of order.items) {
      const item = menuById?.get?.(line.itemId) || menu.find((m) => m.id === line.itemId)
      if (!item || item.available === false) { skipped += 1; continue }
      const choices = (item.opts || []).flatMap((g) => (g.required && g.choices?.length ? [g.choices[0].id] : []))
      addToCart(item, choices, line.qty)
      added += 1
    }
    if (added) toast(`${added} item${added === 1 ? '' : 's'} back in your bag${skipped ? ` · ${skipped} unavailable` : ''}`)
    else toast('Nothing from that order is available right now', 'err')
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pw.next.length < 8) return toast('New password must be at least 8 characters', 'err')
    setBusy(true)
    try {
      await api.post('/auth/password', pw)
      setPw({ current: '', next: '' })
      toast('Password changed')
    } catch (err) { toast(err.message, 'err') } finally { setBusy(false) }
  }

  const activeOrders = (orders || []).filter((o) => !['delivered', 'cancelled'].includes(o.status))

  return (
    <div className="account-page">
      <div className="wrap">
        <div className="account-head">
          <div className="avatar big">{user.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <h1 className="disp">{user.name}</h1>
            <p className="muted">{user.phone}{user.email ? ` · ${user.email}` : ''}</p>
          </div>
          <div className="account-points">
            <b>{user.points}</b>
            <span>loyalty points</span>
            <small>= {rs(user.points * 10)} off a future order</small>
          </div>
          <button className="btn o sm" onClick={async () => { await logout(); navigate('/') }}>
            <Icon name="logout" size={14} /> Sign out
          </button>
        </div>

        <div className="tabs">
          {[['orders', 'My orders'], ['profile', 'Profile'], ['security', 'Security']].map(([id, label]) => (
            <button key={id} className={cn(tab === id && 'on')} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'orders' && (
          <div className="orders-list">
            {orders === null && <Spinner label="Loading your orders…" />}
            {orders?.length === 0 && (
              <Empty icon="bag" title="No orders yet" action={<Link to="/menu" className="btn y">Browse the menu</Link>}>
                Your first order is one tap away.
              </Empty>
            )}
            {activeOrders.length > 0 && <h3 className="sub-head">In progress</h3>}
            {activeOrders.map((o) => <OrderRow key={o.id} order={o} live onReorder={reorder} />)}
            {orders && orders.filter((o) => ['delivered', 'cancelled'].includes(o.status)).length > 0 && (
              <h3 className="sub-head">Past orders</h3>
            )}
            {(orders || []).filter((o) => ['delivered', 'cancelled'].includes(o.status)).map((o) => (
              <OrderRow key={o.id} order={o} onReorder={reorder} />
            ))}
          </div>
        )}

        {tab === 'profile' && (
          <form className="blk narrow" onSubmit={saveProfile}>
            <h3 className="disp">Your details</h3>
            <div className="row2">
              <Field label="Full name"><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
              <Field label="Mobile number" hint="Contact us to change your number">
                <input value={profile.phone} disabled />
              </Field>
            </div>
            <Field label="Email (optional)"><input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="you@example.com" /></Field>
            <Field label="Default delivery address" hint="We prefill this at checkout">
              <textarea rows={2} value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} placeholder="House #, street, mohalla" />
            </Field>
            <button className="btn y" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </form>
        )}

        {tab === 'security' && (
          <form className="blk narrow" onSubmit={changePassword}>
            <h3 className="disp">Change password</h3>
            <Field label="Current password"><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></Field>
            <Field label="New password" hint="At least 8 characters"><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></Field>
            <button className="btn y" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
            <p className="muted small">Lost access to your number? Call {s.phone1} and we will help.</p>
          </form>
        )}
      </div>
    </div>
  )
}

function OrderRow({ order, live, onReorder }) {
  const p = order.progress || {}
  const done = order.status === 'delivered'
  const cancelled = order.status === 'cancelled'

  return (
    <div className={cn('order-row', live && 'live')}>
      <Link to={`/track/${order.id}${order.trackToken ? `?t=${order.trackToken}` : ''}`} className="or-link">
        <div className="or-top">
          <b className="mono">{order.id}</b>
          <span className={cn('chip', `st-${order.status}`)}>{STATUS_SHORT[order.status]}</span>
          <span className="or-when">{dayLabel(order.createdAt)} · {clock(order.createdAt)}</span>
        </div>

        {/* plain-language progress, so the chip is not the only clue */}
        {live && !cancelled && p.total ? (
          <div className="or-progress">
            <div className="or-bar"><i style={{ width: `${(p.step / p.total) * 100}%` }} /></div>
            <span>{p.label} · step {p.step} of {p.total}</span>
          </div>
        ) : null}

        {order.rider && !done && !cancelled ? (
          <div className="or-rider">
            <Icon name="bike" size={13} />
            {order.rider.name} is bringing it
            <a href={`tel:${order.rider.phone}`} onClick={(e) => e.stopPropagation()}>call</a>
          </div>
        ) : null}

        <div className="or-items">
          {order.items.slice(0, 3).map((i, k) => `${i.qty}× ${i.name}`).join(' · ')}
          {order.items.length > 3 && ` +${order.items.length - 3} more`}
        </div>

        <div className="or-foot">
          <span>{order.type === 'pickup' ? 'Pickup' : 'Delivery'} · {PAY_LABEL[order.payMethod]}</span>
          <b>{rs(order.total)}</b>
        </div>
        {order.rating ? <div className="or-rated"><Stars value={order.rating} size={12} /></div> : null}
      </Link>

      {(done || cancelled) && (
        <div className="or-actions">
          <button className="btn o sm" onClick={() => onReorder(order)}>
            <Icon name="bag" size={13} /> Order again
          </button>
          {done && !order.rating && (
            <Link to={`/track/${order.id}${order.trackToken ? `?t=${order.trackToken}` : ''}#rate`} className="btn y sm">
              Rate it
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
