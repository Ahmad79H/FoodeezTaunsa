import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../store.jsx'
import { Icon, Spinner, Empty, Modal, Field, Switch } from '../ui.jsx'
import { api } from '../lib/api.js'
import { asset, rs, cn } from '../lib/utils.js'
import { PhotoField } from './PhotoField.jsx'

const blank = () => ({
  id: '', cat: '', name: '', desc: '', price: 0, was: null, img: '', images: [], tags: [],
  serves: null, available: true, featured: false, spice: 0, veg: false, prepMins: 15, opts: [],
})

export function MenuAdmin() {
  const { toast, refresh } = useApp()
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    try { setData(await api.get('/admin/menu')) } catch (e) { toast(e.message, 'err') }
  }, [toast])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    if (!data) return []
    const ql = q.toLowerCase()
    return data.menu.filter((m) =>
      (cat === 'all' || m.cat === cat) && (!ql || (m.name + m.desc).toLowerCase().includes(ql)))
  }, [data, q, cat])

  const patch = async (m, body, message) => {
    try {
      await api.patch(`/admin/menu/${m.id}`, body)
      if (message) toast(message)
      await load(); refresh()
    } catch (e) { toast(e.message, 'err') }
  }

  const remove = async (m) => {
    if (!confirm(`Delete “${m.name}” permanently?`)) return
    try { await api.del(`/admin/menu/${m.id}`); toast('Dish deleted'); await load(); refresh() }
    catch (e) { toast(e.message, 'err') }
  }

  if (!data) return <Spinner label="Loading the menu…" />
  const soldOut = data.menu.filter((m) => !m.available).length

  return (
    <div className="page">
      <div className="toolbar">
        <select className="sel" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">All categories ({data.menu.length})</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({data.menu.filter((m) => m.cat === c.id).length})</option>
          ))}
        </select>
        <label className="srch">
          <Icon name="search" size={15} />
          <input placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {soldOut > 0 && <span className="chip st-cancelled">{soldOut} sold out</span>}
        <div className="sp" />
        <button className="btn y sm" onClick={() => setEditing(blank())}>+ Add dish</button>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Dish</th><th>Category</th><th className="right">Price</th><th>Prep</th><th>Featured</th><th>Available</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={cn(!m.available && 'dim')}>
                <td>
                  <div className="tm">
                    <img src={asset(m.img)} alt="" />
                    <div><b>{m.name}</b><small className="ellipsis">{m.desc}</small></div>
                  </div>
                </td>
                <td><span className="chip">{data.categories.find((c) => c.id === m.cat)?.name || m.cat}</span></td>
                <td className="right">
                  <b>{rs(m.price)}</b>
                  {m.was ? <><br /><small className="muted"><s>{rs(m.was)}</s></small></> : null}
                </td>
                <td>{m.prepMins}m</td>
                <td><Switch checked={m.featured} onChange={() => patch(m, { featured: !m.featured })} label="Featured" /></td>
                <td><Switch checked={m.available} onChange={() => patch(m, { available: !m.available }, `${m.name} ${m.available ? 'marked sold out' : 'back on the menu'}`)} label="Available" /></td>
                <td className="right nowrap">
                  <button className="ibtn" onClick={() => setEditing(m)} aria-label="Edit"><Icon name="edit" size={15} /></button>
                  <button className="ibtn danger" onClick={() => remove(m)} aria-label="Delete"><Icon name="trash" size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <Empty icon="search" title="Nothing matches" />}

      {editing && (
        <ItemEditor item={editing} categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); refresh() }} />
      )}
    </div>
  )
}

function ItemEditor({ item, categories, onClose, onSaved }) {
  const { toast } = useApp()
  const isNew = !item.name
  const [f, setF] = useState({
    id: item.id || '', cat: item.cat || categories[0]?.id || '', name: item.name || '',
    desc: item.desc || '', price: item.price || 0, was: item.was ?? '',
    images: item.images?.length ? item.images : item.img ? [item.img] : [],
    tags: (item.tags || []).join(', '), serves: item.serves ?? '',
    available: item.available !== false, featured: !!item.featured, spice: item.spice || 0,
    veg: !!item.veg, prepMins: item.prepMins || 15,
    opts: (item.opts || []).map((g) => ({
      group: g.group, required: !!g.required, multi: !!g.multi,
      choices: g.choices.map((c) => ({ n: c.n, p: c.p })),
    })),
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))

  const save = async () => {
    setErr(''); setBusy(true)
    try {
      const payload = {
        id: f.id.trim().toLowerCase().replace(/\s+/g, '-'),
        cat: f.cat, name: f.name.trim(), descr: f.desc.trim(),
        price: Number(f.price), was: f.was === '' ? null : Number(f.was),
        images: f.images, img: f.images[0] || '',
        tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
        serves: f.serves === '' ? null : Number(f.serves),
        available: f.available, featured: f.featured, spice: Number(f.spice),
        veg: f.veg, prepMins: Number(f.prepMins),
        opts: f.opts.map((g) => ({
          group: g.group, required: g.required, multi: g.multi,
          choices: g.choices.filter((c) => c.n.trim()).map((c) => ({ n: c.n.trim(), p: Number(c.p) || 0 })),
        })).filter((g) => g.choices.length),
      }
      if (isNew) await api.post('/admin/menu', payload)
      else await api.patch(`/admin/menu/${item.id}`, payload)
      toast(isNew ? 'Dish added' : 'Dish updated')
      onSaved()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const addGroup = () => setF((v) => ({ ...v, opts: [...v.opts, { group: 'Size', required: true, multi: false, choices: [{ n: '', p: 0 }] }] }))
  const updGroup = (gi, patch2) => setF((v) => ({ ...v, opts: v.opts.map((g, i) => (i === gi ? { ...g, ...patch2 } : g)) }))
  const delGroup = (gi) => setF((v) => ({ ...v, opts: v.opts.filter((_, i) => i !== gi) }))
  const updChoice = (gi, ci, patch2) => setF((v) => ({
    ...v,
    opts: v.opts.map((g, i) => (i === gi ? { ...g, choices: g.choices.map((c, j) => (j === ci ? { ...c, ...patch2 } : c)) } : g)),
  }))
  const addChoice = (gi) => setF((v) => ({ ...v, opts: v.opts.map((g, i) => (i === gi ? { ...g, choices: [...g.choices, { n: '', p: 0 }] } : g)) }))
  const delChoice = (gi, ci) => setF((v) => ({ ...v, opts: v.opts.map((g, i) => (i === gi ? { ...g, choices: g.choices.filter((_, j) => j !== ci) } : g)) }))

  return (
    <Modal open onClose={onClose} className="editor-modal" labelledBy="ed-title">
      <div className="om-head">
        <h3 id="ed-title">{isNew ? 'Add a dish' : `Edit ${item.name}`}</h3>
        <button className="x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
      </div>

      <div className="om-body">
        <div className="row2">
          <Field label="Name"><input value={f.name} onChange={set('name')} placeholder="Chicken Karahi" /></Field>
          <Field label="Item id" hint="Letters, numbers and dashes">
            <input value={f.id} onChange={set('id')} disabled={!isNew} placeholder="k1" />
          </Field>
        </div>

        <Field label="Description"><textarea rows={2} value={f.desc} onChange={set('desc')} /></Field>

        <div className="row3">
          <Field label="Category">
            <select value={f.cat} onChange={set('cat')}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Price (Rs)"><input type="number" min="0" value={f.price} onChange={set('price')} /></Field>
          <Field label="Compare-at (optional)"><input type="number" min="0" value={f.was} onChange={set('was')} /></Field>
        </div>

        <div className="row3">
          <Field label="Prep minutes"><input type="number" min="1" value={f.prepMins} onChange={set('prepMins')} /></Field>
          <Field label="Serves (optional)"><input type="number" min="1" value={f.serves} onChange={set('serves')} /></Field>
          <Field label="Spice level">
            <select value={f.spice} onChange={set('spice')}>
              <option value="0">None</option><option value="1">Mild</option><option value="2">Medium</option><option value="3">Hot</option>
            </select>
          </Field>
        </div>

        <PhotoField
          value={f.images}
          onChange={(images) => setF((v) => ({ ...v, images }))}
          onError={setErr}
        />
        <Field label="Tags" hint="Comma separated, e.g. Best seller, Spicy">
          <input value={f.tags} onChange={set('tags')} placeholder="Best seller, Spicy" />
        </Field>

        <div className="toggles">
          <label className="toggle"><Switch checked={f.available} onChange={(v) => setF({ ...f, available: v })} /> Available</label>
          <label className="toggle"><Switch checked={f.featured} onChange={(v) => setF({ ...f, featured: v })} /> Featured on home</label>
          <label className="toggle"><Switch checked={f.veg} onChange={(v) => setF({ ...f, veg: v })} /> Vegetarian</label>
        </div>

        <div className="opts-head">
          <h5>Options &amp; sizes</h5>
          <button className="btn o sm" onClick={addGroup}>+ Option group</button>
        </div>

        {f.opts.map((g, gi) => (
          <div className="opt-group" key={gi}>
            <div className="og-row">
              <input value={g.group} onChange={(e) => updGroup(gi, { group: e.target.value })} placeholder="Group name" />
              <label className="mini-check"><input type="checkbox" checked={g.required} onChange={(e) => updGroup(gi, { required: e.target.checked })} /> Required</label>
              <label className="mini-check"><input type="checkbox" checked={g.multi} onChange={(e) => updGroup(gi, { multi: e.target.checked })} /> Multi</label>
              <button className="ibtn danger" onClick={() => delGroup(gi)} aria-label="Remove group"><Icon name="trash" size={14} /></button>
            </div>
            {g.choices.map((c, ci) => (
              <div className="oc-row" key={ci}>
                <input value={c.n} onChange={(e) => updChoice(gi, ci, { n: e.target.value })} placeholder="Choice label" />
                <input type="number" min="0" value={c.p} onChange={(e) => updChoice(gi, ci, { p: e.target.value })} placeholder="Price" />
                <button className="ibtn danger" onClick={() => delChoice(gi, ci)} aria-label="Remove choice"><Icon name="close" size={13} /></button>
              </div>
            ))}
            <button className="linkbtn" onClick={() => addChoice(gi)}>+ Add choice</button>
            <p className="hint">Required options set the dish price (like a size). Optional options add to it.</p>
          </div>
        ))}

        {err && <div className="warn">{err}</div>}
      </div>

      <div className="om-foot">
        <button className="btn o sm" onClick={onClose}>Cancel</button>
        <div className="sp" />
        <button className="btn y" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save dish'}</button>
      </div>
    </Modal>
  )
}
