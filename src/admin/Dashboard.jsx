import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, Spinner, Empty } from '../ui.jsx'
import { api, connectEvents } from '../lib/api.js'
import { cn, rs, minsAgo, STATUS_SHORT } from '../lib/utils.js'
import { OrderDrawer } from './Operations.jsx'

export default function Dashboard() {
  const { toast, refresh } = useApp()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await api.get('/admin/dashboard'))
      setErr('')
    } catch (e) { setErr(e.message) }
  }, [])

  // Always call the latest load() from timers and the SSE stream
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    load()
    const i = setInterval(() => loadRef.current(), 3500)
    return () => clearInterval(i)
  }, [load])

  // Live orders land here the moment they change, instead of waiting for the
  // 20s polling timer.
  useEffect(() => {
    const off = connectEvents(() => loadRef.current())
    return off
  }, [])

  const clearDemo = async () => {
    if (!confirm('Delete all order history? The menu, settings and staff are kept.\n\nThis cannot be undone.')) return
    setBusy(true)
    try {
      await api.post('/admin/demo-data/clear')
      // Drop the current snapshot first so the UI fully re-renders with the
      // empty state rather than flashing the stale numbers we just cleared.
      setData(null)
      await load()
      await refresh()
      toast('Order history cleared')
    } catch (e) { toast(e.message, 'err') } finally { setBusy(false) }
  }

  if (err) return <Empty icon="alert" title="Could not load the dashboard">{err}</Empty>
  if (!data) return <Spinner label="Loading dashboard…" />

  const { stats, live, activity, demoData } = data
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.revenue))
  const statusOrder = ['new', 'preparing', 'ready', 'out', 'delivered', 'cancelled']

  return (
    <div className="dash">
      {demoData && (
        <div className="notice">
          <Icon name="alert" size={16} />
          <div>
            <b>This database contains generated demo history.</b>
            <span>Clear it before going live — the menu and settings stay exactly as they are.</span>
          </div>
          <button className="btn k sm" onClick={clearDemo} disabled={busy}>Clear demo orders</button>
        </div>
      )}

      <div className="kpis">
        <Kpi label="Revenue today" value={rs(stats.today.revenue)} sub={`${stats.today.orders} delivered orders`} icon="chart" />
        <Kpi label="Last 7 days" value={rs(stats.week.revenue)} sub={`${stats.week.orders} orders · avg ${rs(stats.week.avgOrder)}`} icon="box" />
        <Link to="/orders?status=active" style={{ textDecoration: 'none', color: 'inherit' }} title="View active orders">
          <Kpi label="Live right now" value={stats.liveOrders} sub="in the pipeline" icon="fire" tone="live" />
        </Link>
        <Kpi label="Rating" value={stats.rating.average ? stats.rating.average.toFixed(1) : '—'} sub={`${stats.rating.count} rated orders`} icon="star" />
      </div>

      <div className="dash-grid">
        <section className="blk">
          <div className="blk-head">
            <h3>Revenue · last 7 days</h3>
            <span className="muted small">delivered only</span>
          </div>
          <div className="bars">
            {stats.daily.length === 0 && <Empty icon="chart" title="No delivered orders yet" />}
            {stats.daily.map((d) => (
              <div className="bar-col" key={d.day}>
                <div className="bar-val">{d.revenue ? rs(d.revenue) : ''}</div>
                <div className="bar-track">
                  <i style={{ height: `${(d.revenue / maxDaily) * 100}%` }} />
                </div>
                <div className="bar-lbl">{new Date(d.day).toLocaleDateString([], { weekday: 'short' })}</div>
              </div>
            ))}
          </div>

          <div className="blk-head" style={{ marginTop: 24 }}>
            <h3>Busiest hours</h3>
          </div>
          <div className="hours">
            {Array.from({ length: 14 }, (_, i) => i + 11).map((h) => {
              const found = stats.hourly.find((x) => x.hour === h)
              const n = found?.orders || 0
              const max = Math.max(1, ...stats.hourly.map((x) => x.orders))
              return (
                <div key={h} className="hour" title={`${n} orders`}>
                  <div className="h-track"><i style={{ height: `${(n / max) * 100}%` }} /></div>
                  <span>{h > 12 ? h - 12 : h}{h >= 12 ? 'p' : 'a'}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="blk">
          <div className="blk-head">
            <h3>Pipeline</h3>
            <Link to="/orders" className="linkbtn2">All orders <Icon name="arrow" size={13} /></Link>
          </div>
          <div className="pipeline">
            {statusOrder.map((st) => {
              const n = stats.byStatus.find((x) => x.status === st)?.n || 0
              return (
                <div className="pipe-row" key={st}>
                  <span className={cn('chip', `st-${st}`)}>{STATUS_SHORT[st]}</span>
                  <span className="pipe-bar"><i style={{ width: `${Math.min(100, n * 8)}%` }} /></span>
                  <b>{n}</b>
                </div>
              )
            })}
          </div>

          <div className="blk-head" style={{ marginTop: 22 }}>
            <h3>Top sellers · 7 days</h3>
          </div>
          <ol className="top-items">
            {stats.topItems.length === 0 && <li className="muted small">No sales yet.</li>}
            {stats.topItems.map((t, i) => (
              <li key={t.name}>
                <span className="rank">{i + 1}</span>
                <span className="ti-name">{t.name}</span>
                <span className="ti-qty">{t.qty} sold</span>
                <b>{rs(t.revenue)}</b>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="dash-grid">
        <section className="blk">
          <div className="blk-head">
            <h3>Live orders</h3>
            <span className="live-pill small"><span className="status-dot" /> {live.length} active</span>
          </div>
          {live.length === 0
            ? <Empty icon="box" title="Nothing in the kitchen">New orders appear here instantly.</Empty>
            : (
              <ul className="live-list">
                {live.slice(0, 8).map((o) => (
                  <li key={o.id} onClick={() => setOpenId(o.id)} style={{ cursor: 'pointer' }} className="rowlink" title="Open order">
                    <div className="ll-main">
                      <b className="mono">{o.id}</b>
                      <span className={cn('chip', `st-${o.status}`)}>{STATUS_SHORT[o.status]}</span>
                      <small>{o.customer.name} · {o.type}</small>
                    </div>
                    <span className="ll-amt">{rs(o.total)}</span>
                    <span className="ll-time">{minsAgo(o.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="blk">
          <div className="blk-head"><h3>Recent activity</h3></div>
          <ul className="activity">
            {activity.length === 0 && <li className="muted small">Nothing yet.</li>}
            {activity.map((a, i) => (
              <li key={i}>
                <span className={cn('dot', `st-${a.status}`)} />
                <div>
                  <b className="mono">{a.order_id}</b> <span className={cn('chip sm', `st-${a.status}`)}>{STATUS_SHORT[a.status] || a.status}</span>
                  <small>{a.name || 'Guest'} · {minsAgo(a.at)}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <OrderDrawer id={openId} order={live.find((o) => o.id === openId) || null} onClose={() => setOpenId(null)} onChange={load} />
    </div>
  )
}

function Kpi({ label, value, sub, icon, tone }) {
  return (
    <div className={cn('kpi', tone && `kpi-${tone}`)}>
      <div className="kpi-top">
        <span>{label}</span>
        <Icon name={icon} size={16} />
      </div>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  )
}
