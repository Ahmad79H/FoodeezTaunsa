import { useEffect, useState } from 'react'
import { Link, RouterProvider, matchPath, useRouter } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, Spinner, Field } from '../ui.jsx'
import { cn } from '../lib/utils.js'
import { api } from '../lib/api.js'

import Dashboard from './Dashboard.jsx'
import { Orders, Kitchen, Reservations } from './Operations.jsx'
import { MenuAdmin } from './Menu.jsx'
import { PromosAdmin } from './Promos.jsx'
import { CustomersAdmin, RidersAdmin, ReviewsAdmin, StaffAdmin } from './People.jsx'
import { SettingsAdmin } from './Settings.jsx'

const NAV = [
  { group: 'Operations' },
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', path: '/dashboard' },
  { id: 'orders', label: 'Orders', icon: 'box', path: '/orders', badge: true },
  { id: 'kitchen', label: 'Kitchen display', icon: 'fire', path: '/kitchen' },
  { id: 'reservations', label: 'Reservations', icon: 'calendar', path: '/reservations' },
  { group: 'Catalogue' },
  { id: 'menu', label: 'Menu', icon: 'tag', path: '/menu', roles: ['owner', 'counter'] },
  { id: 'promos', label: 'Deals & promos', icon: 'tag', path: '/promos', roles: ['owner', 'counter'] },
  { group: 'People' },
  { id: 'customers', label: 'Customers', icon: 'users', path: '/customers', roles: ['owner', 'counter'] },
  { id: 'riders', label: 'Riders', icon: 'bike', path: '/riders', roles: ['owner', 'counter'] },
  { id: 'reviews', label: 'Reviews', icon: 'message', path: '/reviews', roles: ['owner', 'counter'] },
  { group: 'System' },
  { id: 'staff', label: 'Staff & access', icon: 'shield', path: '/staff', roles: ['owner'] },
  { id: 'settings', label: 'Settings', icon: 'gear', path: '/settings', roles: ['owner'] },
]

export default function AdminRoot() {
  return (
    <RouterProvider basename="/admin">
      <AdminApp />
    </RouterProvider>
  )
}

function AdminApp() {
  const { user } = useApp()
  if (user === undefined) return <div className="admin-boot"><Spinner label="Starting…" /></div>
  if (!user || user.role === 'customer') return <StaffLogin />
  return <Shell />
}

/* ------------------------------ staff login ----------------------------- */

function StaffLogin() {
  const { loginStaff, toast } = useApp()
  const [form, setForm] = useState({ email: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await loginStaff(form.email.trim(), form.password)
      toast('Signed in')
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  return (
    <div className="staff-login">
      <div className="sl-card">
        <div className="sl-brand"><img src="/assets/logo.png" alt="" /><b>FOODEEZ</b></div>
        <h1 className="disp">Run the kitchen.</h1>
        <p className="muted">Orders, kitchen, menu, riders and reports — one place for the whole team.</p>

        <form onSubmit={submit}>
          <Field label="Email">
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@foodeez.pk" autoComplete="username" required />
          </Field>
          <Field label="Password">
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••" autoComplete="current-password" required />
          </Field>
          {err && <div className="warn">{err}</div>}
          <button className="btn y wide tall" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <p className="sl-foot"><a href="/">← Back to the website</a></p>
      </div>
      <div className="sl-aside">
        <div className="sl-aside-inner">
          <b>Everything in one screen</b>
          <ul>
            <li><Icon name="check" size={14} stroke={3} /> Live order board with sound</li>
            <li><Icon name="check" size={14} stroke={3} /> Kitchen display built for a busy pass</li>
            <li><Icon name="check" size={14} stroke={3} /> Menu, prices and sold-out in two taps</li>
            <li><Icon name="check" size={14} stroke={3} /> Reservations, riders and review moderation</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- shell -------------------------------- */

function Shell() {
  const { user, logout, settings: s = {} } = useApp()
  const { path, navigate } = useRouter()
  const [open, setOpen] = useState(false)
  const [live, setLive] = useState({ count: 0, connected: false })

  const visible = NAV.map((n) => (n.group ? n : (!n.roles || n.roles.includes(user.role) ? n : null))).filter(Boolean)

  useEffect(() => { setOpen(false) }, [path])

  const page = () => {
    if (path === '/' || path === '/dashboard') return <Dashboard />
    if (path === '/orders') return <Orders />
    if (path === '/kitchen') return <Kitchen />
    if (path === '/reservations') return <Reservations />
    if (path === '/menu') return <MenuAdmin />
    if (path === '/promos') return <PromosAdmin />
    if (path === '/customers') return <CustomersAdmin />
    if (path === '/riders') return <RidersAdmin />
    if (path === '/reviews') return <ReviewsAdmin />
    if (path === '/staff') return <StaffAdmin />
    if (path === '/settings') return <SettingsAdmin />
    return <Dashboard />
  }

  const title = NAV.find((n) => n.path === (path === '/' ? '/dashboard' : path))?.label || 'Dashboard'

  return (
    <div className="admin">
      <aside className={cn('sidebar', open && 'open')}>
        <div className="sb-brand">
          <img src="/assets/logo.png" alt="" />
          <div><b>FOODEEZ</b><small>Admin</small></div>
        </div>

        <nav className="sb-nav">
          {visible.map((n, i) => n.group
            ? <div className="sb-group" key={'g' + i}>{n.group}</div>
            : (
              <Link key={n.id} to={n.path} className={cn('sb-link', isOn(path, n.path) && 'on')}>
                <Icon name={n.icon} size={17} />
                <span>{n.label}</span>
                {n.badge && live.count > 0 && <em className="sb-badge">{live.count}</em>}
              </Link>
            ))}
        </nav>

        <div className="sb-foot">
          <div className={cn('live-ind', live.connected && 'on')}>
            <span className="status-dot" /> {live.connected ? 'Live' : 'Reconnecting'}
          </div>
          <div className="sb-user">
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <div><b>{user.name}</b><small>{user.role}</small></div>
            <button onClick={logout} title="Sign out" aria-label="Sign out"><Icon name="logout" size={16} /></button>
          </div>
        </div>
      </aside>

      {open && <div className="sb-scrim" onClick={() => setOpen(false)} />}

      <div className="admin-main">
        <header className="topbar">
          <button className="hamburger admin-burger" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <span /><span /><span />
          </button>
          <h1>{title}</h1>
          <div className="sp" />
          <span className={cn('store-pill', s.open !== false ? 'open' : 'closed')}>
            <span className="status-dot" /> {s.open !== false ? 'Open' : 'Closed'}
          </span>
          <a className="btn k sm" href="/" target="_blank" rel="noreferrer">View site</a>
        </header>

        <div className="admin-body">
          {page()}
        </div>
      </div>

      <LiveWatcher onUpdate={setLive} />
    </div>
  )
}

function isOn(path, target) {
  const p = path === '/' ? '/dashboard' : path
  return p === target
}

/** Keeps the sidebar badge and the live indicator accurate. */
function LiveWatcher({ onUpdate }) {
  useEffect(() => {
    let cancelled = false
    let es

    const connect = async () => {
      const { connectEvents } = await import('../lib/api.js')
      if (cancelled) return
      const off = connectEvents((type) => {
        if (type.startsWith('order.')) refreshCount()
      })
      es = off
    }

    const refreshCount = async () => {
      try {
        const d = await api.get('/admin/dashboard')
        if (!cancelled) onUpdate({ count: d.stats.liveOrders, connected: true })
      } catch {
        if (!cancelled) onUpdate((l) => ({ ...l, connected: false }))
      }
    }

    refreshCount()
    connect()
    const i = setInterval(refreshCount, 4000)

    return () => { cancelled = true; clearInterval(i); es?.() }
  }, [onUpdate])

  return null
}
