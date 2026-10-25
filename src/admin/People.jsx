import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../store.jsx'
import { Icon, Spinner, Empty, Modal, Field, Switch, Stars } from '../ui.jsx'
import { api } from '../lib/api.js'
import { rs, cn } from '../lib/utils.js'

/* ============================== CUSTOMERS =============================== */

export function CustomersAdmin() {
  const { toast } = useApp()
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/admin/customers' + (q ? `?q=${encodeURIComponent(q)}` : ''))
        .then((d) => setList(d.customers)).catch(() => setList([]))
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [q])

  const removeCustomer = async (c) => {
    if (!confirm(`Are you sure you want to delete customer record for "${c.name}" (${c.phone})?`)) return
    try {
      await api.del(`/admin/customers/${c.id}`)
      toast('Customer deleted')
      setList((prev) => prev.filter((x) => x.id !== c.id))
    } catch (e) { toast(e.message, 'err') }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <label className="srch">
          <Icon name="search" size={15} />
          <input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="sp" />
        <span className="muted">{list?.length ?? 0} customer{list?.length === 1 ? '' : 's'}</span>
      </div>

      {!list && <Spinner label="Loading customers…" />}
      {list?.length === 0 && <Empty icon="users" title="No customers yet">They appear after their first order.</Empty>}

      {list?.length > 0 && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Customer</th><th>Phone</th><th>Account</th><th className="right">Orders</th><th className="right">Spent</th><th className="right">Points</th><th>Last order</th><th /></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                    {c.address ? <><br /><small className="muted ellipsis">{c.address}</small></> : null}
                  </td>
                  <td><a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a></td>
                  <td>{c.hasAccount ? <span className="chip st-delivered">Registered</span> : <span className="chip">Guest</span>}</td>
                  <td className="right">{c.orders}</td>
                  <td className="right"><b>{rs(c.spent)}</b></td>
                  <td className="right">{c.points}</td>
                  <td>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}</td>
                  <td className="right">
                    <button className="ibtn" title="Delete customer" aria-label="Delete customer" style={{ color: '#ff5555' }} onClick={() => removeCustomer(c)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ================================ RIDERS ================================ */

export function RidersAdmin() {
  const { toast } = useApp()
  const [list, setList] = useState(null)

  const load = useCallback(async () => {
    try { setList((await api.get('/admin/riders')).riders) } catch (e) { toast(e.message, 'err') }
  }, [toast])
  useEffect(() => { load() }, [load])

  const save = async (r) => {
    try { await api.post('/admin/riders', r); toast('Rider saved'); load() }
    catch (e) { toast(e.message, 'err') }
  }

  const remove = async (r) => {
    if (!confirm(`Are you sure you want to remove rider "${r.name}"?`)) return
    try {
      await api.del(`/admin/riders/${r.id}`)
      toast('Rider removed')
      load()
    } catch (e) { toast(e.message, 'err') }
  }

  if (!list) return <Spinner label="Loading riders…" />

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{list.filter((r) => r.onShift).length} on shift · {list.length} total</span>
        <div className="sp" />
        <button className="btn y sm" onClick={() => save({ id: 'R' + Date.now().toString(36).slice(-4), name: 'New rider', phone: '', bike: '', active: true, onShift: false })}>
          + Add rider
        </button>
      </div>

      <div className="rider-grid">
        {list.map((r) => (
          <article className={cn('rider-card', r.onShift && 'on')} key={r.id}>
            <div className="rc-head">
              <span className="avatar"><Icon name="bike" size={18} /></span>
              <div><b>{r.name}</b><small>{r.bike || 'No bike number'}</small></div>
              <span className={cn('chip', r.onShift ? 'st-ready' : '')}>{r.onShift ? 'On shift' : 'Off'}</span>
            </div>
            <div className="rc-fields">
              <Field label="Name"><input defaultValue={r.name} onBlur={(e) => e.target.value !== r.name && save({ ...r, name: e.target.value })} /></Field>
              <Field label="Phone"><input defaultValue={r.phone} onBlur={(e) => e.target.value !== r.phone && save({ ...r, phone: e.target.value })} /></Field>
              <Field label="Bike"><input defaultValue={r.bike} onBlur={(e) => e.target.value !== r.bike && save({ ...r, bike: e.target.value })} /></Field>
            </div>
            <div className="toggles">
              <label className="toggle"><Switch checked={r.onShift} onChange={(v) => save({ ...r, onShift: v })} /> On shift</label>
              <label className="toggle"><Switch checked={r.active} onChange={(v) => save({ ...r, active: v })} /> Active</label>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn o sm"
                style={{ color: '#ff5555', borderColor: 'rgba(255,85,85,0.3)', padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => remove(r)}
                title="Remove rider"
              >
                <Icon name="trash" size={13} /> Remove rider
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

/* ================================ REVIEWS =============================== */

export function ReviewsAdmin() {
  const { toast, refresh } = useApp()
  const [list, setList] = useState(null)

  const load = useCallback(async () => {
    try { setList((await api.get('/admin/reviews')).reviews) } catch (e) { toast(e.message, 'err') }
  }, [toast])
  useEffect(() => { load() }, [load])

  const setApproved = async (r, approved) => {
    try {
      await api.patch(`/admin/reviews/${r.id}`, { approved })
      toast(approved ? 'Published' : 'Hidden'); load(); refresh()
    } catch (e) { toast(e.message, 'err') }
  }

  if (!list) return <Spinner label="Loading reviews…" />

  const pending = list.filter((r) => !r.approved)

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{pending.length} awaiting approval · {list.length} total</span>
        <div className="sp" />
        <button className="btn o sm" onClick={load}>Refresh</button>
      </div>

      {list.length === 0 && <Empty icon="message" title="No reviews yet">Customers can leave one after a delivered order.</Empty>}

      <div className="review-admin-list">
        {list.map((r) => (
          <article className={cn('review-admin', !r.approved && 'pending')} key={r.id}>
            <div className="ra-head">
              <Stars value={r.rating} size={13} />
              <b>{r.name}</b>
              <span className="muted small">{new Date(r.createdAt).toLocaleDateString()}</span>
              <div className="sp" />
              <span className={cn('chip', r.approved ? 'st-delivered' : 'st-new')}>{r.approved ? 'Published' : 'Pending'}</span>
            </div>
            <p>{r.body}</p>
            <div className="ra-actions">
              {!r.approved
                ? <button className="btn y sm" onClick={() => setApproved(r, true)}>Publish</button>
                : <button className="btn o sm" onClick={() => setApproved(r, false)}>Hide</button>}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

/* ================================= STAFF ================================ */

const ROLES = [
  ['owner', 'Owner — everything'],
  ['counter', 'Counter — orders, menu, reservations'],
  ['kitchen', 'Kitchen — orders + kitchen display'],
  ['rider', 'Rider — deliveries only'],
]

export function StaffAdmin() {
  const { toast } = useApp()
  const [list, setList] = useState(null)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'counter' })
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setList((await api.get('/admin/staff')).staff) } catch (e) { toast(e.message, 'err') }
  }, [toast])
  useEffect(() => { load() }, [load])

  const create = async () => {
    setErr('')
    try {
      await api.post('/admin/staff', { ...f, id: 'u_' + Date.now().toString(36) })
      toast('Staff member added')
      setAdding(false)
      setF({ name: '', email: '', password: '', role: 'counter' })
      load()
    } catch (e) { setErr(e.message) }
  }

  const update = async (u, patch) => {
    try { await api.patch(`/admin/staff/${u.id}`, patch); toast('Updated'); load() }
    catch (e) { toast(e.message, 'err') }
  }

  const removeStaff = async (u) => {
    if (!confirm(`Are you sure you want to remove ${u.name}?`)) return
    try {
      await api.del(`/admin/staff/${u.id}`)
      toast('Staff member removed')
      load()
    } catch (e) { toast(e.message, 'err') }
  }

  if (!list) return <Spinner label="Loading staff…" />

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{list.length} account{list.length === 1 ? '' : 's'}</span>
        <div className="sp" />
        <button className="btn y sm" onClick={() => setAdding(true)}>+ Add staff</button>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th /></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td>
                <td className="mono small">{u.email}</td>
                <td>
                  <select className="sel" value={u.role} onChange={(e) => update(u, { role: e.target.value })}>
                    {ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </td>
                <td><Switch checked={u.active} onChange={(v) => update(u, { active: v })} /></td>
                <td className="right" style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                  <button className="ibtn" title="Set new password" aria-label="Set new password" onClick={() => {
                    const pw = prompt(`New password for ${u.name} (minimum 8 characters)`)
                    if (pw && pw.length >= 8) update(u, { password: pw })
                    else if (pw) toast('Password is too short', 'err')
                  }}><Icon name="shield" size={15} /></button>
                  <button className="ibtn" title="Remove staff account" aria-label="Remove staff account" style={{ color: '#ff5555' }} onClick={() => removeStaff(u)}>
                    <Icon name="trash" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <Modal open onClose={() => setAdding(false)} className="promo-modal" labelledBy="st-title">
          <div className="om-head">
            <h3 id="st-title">Add a staff account</h3>
            <button className="x" onClick={() => setAdding(false)} aria-label="Close"><Icon name="close" size={18} /></button>
          </div>
          <div className="om-body">
            <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Full name" /></Field>
            <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@foodeez.pk" /></Field>
            <Field label="Temporary password" hint="At least 8 characters"><input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
            <Field label="Role">
              <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                {ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Field>
            {err && <div className="warn">{err}</div>}
          </div>
          <div className="om-foot">
            <button className="btn o sm" onClick={() => setAdding(false)}>Cancel</button>
            <div className="sp" />
            <button className="btn y" onClick={create}>Create account</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
