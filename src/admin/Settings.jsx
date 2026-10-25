import { useEffect, useState } from 'react'
import { useApp } from '../store.jsx'
import { Icon, Field, Switch, Spinner } from '../ui.jsx'
import { api } from '../lib/api.js'
import { rs } from '../lib/utils.js'

export function SettingsAdmin() {
  const { toast, refresh, user } = useApp()
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [demoData, setDemoData] = useState(false)

  useEffect(() => {
    api.get('/admin/settings').then((d) => setF(d.settings)).catch((e) => toast(e.message, 'err'))
    api.get('/admin/dashboard').then((d) => setDemoData(!!d.demoData)).catch(() => {})
  }, [toast])

  if (!f) return <Spinner label="Loading settings…" />

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))
  const num = (k) => (e) => setF((v) => ({ ...v, [k]: Number(e.target.value) }))

  const save = async () => {
    setBusy(true)
    try {
      const payload = {
        name: f.name, tagline: f.tagline, address: f.address, phone1: f.phone1, phone2: f.phone2,
        email: f.email, hours: f.hours, open: !!f.open, acceptingOrders: !!f.acceptingOrders,
        deliveryFee: Number(f.deliveryFee), freeDeliveryOver: Number(f.freeDeliveryOver),
        minOrder: Number(f.minOrder), eta: Number(f.eta), radiusKm: Number(f.radiusKm),
        taxPct: Number(f.taxPct || 0),
      }
      const r = await api.put('/admin/settings', payload)
      setF(r.settings)
      await refresh()
      toast('Settings saved')
    } catch (e) { toast(e.message, 'err') } finally { setBusy(false) }
  }

  const clearDemo = async () => {
    if (!confirm('Delete all order history? Menu, settings and staff are kept. This cannot be undone.')) return
    try {
      await api.post('/admin/demo-data/clear')
      setDemoData(false)
      toast('Order history cleared')
      await refresh()
    } catch (e) { toast(e.message, 'err') }
  }

  return (
    <div className="page settings-page">
      <section className="blk">
        <h3 className="disp">Store</h3>
        <div className="toggles big">
          <label className="toggle">
            <Switch checked={!!f.open} onChange={(v) => setF({ ...f, open: v })} />
            <span><b>Store is open</b><small>Shows “Open now” across the site</small></span>
          </label>
          <label className="toggle">
            <Switch checked={!!f.acceptingOrders} onChange={(v) => setF({ ...f, acceptingOrders: v })} />
            <span><b>Accepting new orders</b><small>Turn off to pause checkout during a rush</small></span>
          </label>
        </div>

        <div className="row2">
          <Field label="Restaurant name"><input value={f.name || ''} onChange={set('name')} /></Field>
          <Field label="Tagline"><input value={f.tagline || ''} onChange={set('tagline')} /></Field>
        </div>
        <Field label="Address"><input value={f.address || ''} onChange={set('address')} /></Field>
        <div className="row3">
          <Field label="Delivery phone"><input value={f.phone1 || ''} onChange={set('phone1')} /></Field>
          <Field label="Bookings phone"><input value={f.phone2 || ''} onChange={set('phone2')} /></Field>
          <Field label="Email"><input value={f.email || ''} onChange={set('email')} /></Field>
        </div>
        <Field label="Opening hours"><input value={f.hours || ''} onChange={set('hours')} /></Field>
      </section>

      <section className="blk">
        <h3 className="disp">Delivery &amp; pricing</h3>
        <div className="row3">
          <Field label="Delivery fee (Rs)"><input type="number" min="0" value={f.deliveryFee ?? 0} onChange={num('deliveryFee')} /></Field>
          <Field label="Free delivery over (Rs)"><input type="number" min="0" value={f.freeDeliveryOver ?? 0} onChange={num('freeDeliveryOver')} /></Field>
          <Field label="Minimum order (Rs)"><input type="number" min="0" value={f.minOrder ?? 0} onChange={num('minOrder')} /></Field>
        </div>
        <div className="row3">
          <Field label="Delivery ETA (minutes)"><input type="number" min="5" value={f.eta ?? 35} onChange={num('eta')} /></Field>
          <Field label="Delivery radius (km)"><input type="number" min="0.5" step="0.5" value={f.radiusKm ?? 6} onChange={num('radiusKm')} /></Field>
          <Field label="Tax %" hint="Leave at 0 to include tax in prices"><input type="number" min="0" max="50" value={f.taxPct ?? 0} onChange={num('taxPct')} /></Field>
        </div>
        <p className="hint">
          Right now: delivery <b>{rs(f.deliveryFee || 0)}</b>, free over <b>{rs(f.freeDeliveryOver || 0)}</b>,
          minimum order <b>{rs(f.minOrder || 0)}</b>.
        </p>
      </section>

      <div className="page-actions">
        <button className="btn y" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </div>

      <section className="blk danger-zone">
        <h3 className="disp">Demo data</h3>
        <p>
          The database currently {demoData ? 'contains' : 'does not contain'} generated demo order history.
          Clearing it removes orders only — the menu, prices, settings and staff accounts stay untouched.
        </p>
        <button className="btn o" onClick={clearDemo} disabled={!demoData}>
          <Icon name="trash" size={15} /> Clear order history
        </button>
      </section>

      <section className="blk">
        <h3 className="disp">Your account</h3>
        <p className="muted">
          Signed in as <b>{user?.name}</b> ({user?.role}) · {user?.email}
        </p>
        <p className="hint">
          Change your own password from the <b>Staff &amp; access</b> page (owner only), or ask the owner.
        </p>
      </section>
    </div>
  )
}
