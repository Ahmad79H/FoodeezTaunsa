import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../store.jsx'
import { Icon, Spinner, Empty, Modal, Field, Switch } from '../ui.jsx'
import { api } from '../lib/api.js'
import { rs, cn } from '../lib/utils.js'

export function PromosAdmin() {
  const { toast, refresh } = useApp()
  const [list, setList] = useState(null)
  const [edit, setEdit] = useState(null)

  const load = useCallback(async () => {
    try { setList((await api.get('/admin/promos')).promos) } catch (e) { toast(e.message, 'err') }
  }, [toast])

  useEffect(() => { load() }, [load])

  const remove = async (p) => {
    if (!confirm(`Delete promo ${p.code}?`)) return
    try { await api.del(`/admin/promos/${p.id}`); toast('Promo deleted'); load(); refresh() }
    catch (e) { toast(e.message, 'err') }
  }

  const toggle = async (p) => {
    try { await api.post('/admin/promos', { ...p, active: !p.active }); load() }
    catch (e) { toast(e.message, 'err') }
  }

  if (!list) return <Spinner label="Loading promos…" />

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{list.length} code{list.length === 1 ? '' : 's'} · {list.filter((p) => p.active).length} active</span>
        <div className="sp" />
        <button className="btn y sm" onClick={() => setEdit({ id: 'pr_' + Date.now().toString(36), code: '', type: 'pct', value: 10, min: 0, active: true, cap: null })}>
          + New promo
        </button>
      </div>

      {list.length === 0 && <Empty icon="tag" title="No promo codes yet">Create one to run an offer.</Empty>}

      <div className="promo-grid">
        {list.map((p) => (
          <article className={cn('promo-card', !p.active && 'off')} key={p.id}>
            <div className="pc-top">
              <b className="mono">{p.code}</b>
              <span className={cn('chip', p.active ? 'st-delivered' : 'st-cancelled')}>{p.active ? 'Active' : 'Paused'}</span>
            </div>
            <div className="pc-value">{p.type === 'pct' ? `${p.value}% off` : `${rs(p.value)} off`}</div>
            <div className="pc-meta">
              <span>Min order {rs(p.min)}</span>
              <span>Used {p.uses}{p.cap ? ` / ${p.cap}` : ''} times</span>
            </div>
            <div className="pc-actions">
              <button className="btn o sm" onClick={() => setEdit(p)}>Edit</button>
              <button className="btn o sm" onClick={() => toggle(p)}>{p.active ? 'Pause' : 'Resume'}</button>
              <button className="ibtn danger" onClick={() => remove(p)} aria-label="Delete"><Icon name="trash" size={14} /></button>
            </div>
          </article>
        ))}
      </div>

      {edit && <PromoEditor promo={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}

function PromoEditor({ promo, onClose, onSaved }) {
  const { toast } = useApp()
  const [f, setF] = useState({ ...promo, cap: promo.cap ?? '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setErr(''); setBusy(true)
    try {
      await api.post('/admin/promos', {
        ...f,
        code: f.code.toUpperCase().trim(),
        value: Number(f.value),
        min: Number(f.min),
        cap: f.cap === '' ? null : Number(f.cap),
      })
      toast('Promo saved'); onSaved()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} className="promo-modal" labelledBy="pm-title">
      <div className="om-head">
        <h3 id="pm-title">{promo.code ? `Edit ${promo.code}` : 'New promo code'}</h3>
        <button className="x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
      </div>
      <div className="om-body">
        <div className="row2">
          <Field label="Code"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="JOY10" /></Field>
          <Field label="Type">
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="pct">Percentage off</option>
              <option value="flat">Flat rupees off</option>
            </select>
          </Field>
        </div>
        <div className="row3">
          <Field label={f.type === 'pct' ? 'Percent' : 'Rupees'}>
            <input type="number" min="1" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          </Field>
          <Field label="Minimum order">
            <input type="number" min="0" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
          </Field>
          <Field label="Usage cap" hint="Blank = unlimited">
            <input type="number" min="1" value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value })} />
          </Field>
        </div>
        <label className="toggle"><Switch checked={!!f.active} onChange={(v) => setF({ ...f, active: v })} /> Active</label>
        {err && <div className="warn">{err}</div>}
      </div>
      <div className="om-foot">
        <button className="btn o sm" onClick={onClose}>Cancel</button>
        <div className="sp" />
        <button className="btn y" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save promo'}</button>
      </div>
    </Modal>
  )
}
