import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store.jsx'
import { Icon, Modal, Stars } from '../ui.jsx'
import { asset, cn, rs, unitPrice, optionLabel } from '../lib/utils.js'

/* ------------------------------- item card ------------------------------ */

export function ItemCard({ item, qtyInCart = 0, onOpen }) {
  const tag = item.tags?.[0]
  return (
    <article className={cn('item', !item.available && 'off')} onClick={() => item.available && onOpen?.(item)}>
      <div className="ph">
        <img src={asset(item.img)} alt={item.name} loading="lazy" />
        <div className="ph-badges">
          {tag && <span className={cn('tag', tag.replace(/\s+/g, '-'))}>{tag}</span>}
          {item.veg && <span className="tag veg"><Icon name="leaf" size={11} stroke={2.4} /></span>}
        </div>
        {qtyInCart > 0 && <span className="incart">×{qtyInCart}</span>}
        {!item.available && <span className="soldout">Sold out</span>}
      </div>
      <div className="body">
        <h4>{item.name}</h4>
        <p>{item.desc}</p>
        <div className="foot">
          <div className="pr">
            {item.opts?.some((o) => o.required) && <small>from </small>}
            {rs(item.price)}
            {item.was && <s>{rs(item.was)}</s>}
          </div>
          <button className="plus" aria-label={`Add ${item.name}`} disabled={!item.available}>
            <Icon name="plus" size={16} stroke={2.6} />
          </button>
        </div>
      </div>
    </article>
  )
}

/* ------------------------------- item modal ----------------------------- */

/** Default selection for a dish: first choice of every required group. */
const defaultSel = (it) => (it?.opts || []).map((g) => (g.required && g.choices?.length ? [g.choices[0].id] : []))

export function ItemModal({ item, onClose }) {
  const { addToCart } = useApp()

  /*
   * This component stays mounted with `item = null` between opens, so state has
   * to be re-derived the moment a different dish arrives. Doing it in an effect
   * was too late: the first render after a click still held the previous (empty)
   * selection, and `sel[i].length` threw — blanking the whole page for any dish
   * that has options. Adjusting during render fixes it before paint.
   */
  const [sel, setSel] = useState(() => defaultSel(item))
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(0)
  const [forId, setForId] = useState(item?.id ?? null)

  if ((item?.id ?? null) !== forId) {
    setForId(item?.id ?? null)
    setSel(defaultSel(item))
    setQty(1)
    setNote('')
    setPhoto(0)
  }

  const gallery = item?.images?.length ? item.images : item?.img ? [item.img] : []
  const choices = useMemo(() => sel.flat(), [sel])
  const unit = unitPrice(item, choices)
  const missing = (item?.opts || []).some((g, i) => g.required && (sel[i]?.length ?? 0) === 0)

  if (!item) return null

  const toggle = (gi, id) => setSel((prev) => prev.map((arr, i) => {
    if (i !== gi) return arr
    const g = item.opts[gi]
    if (!g.multi) return [id]
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
  }))

  return (
    <Modal open={!!item} onClose={onClose} className="item-modal" labelledBy="im-title">
      <div className="im-img">
        <img src={asset(gallery[photo] || item.img)} alt="" />
        <button className="x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        {gallery.length > 1 && (
          <div className="im-thumbs" role="tablist" aria-label="Dish photos">
            {gallery.map((g, i) => (
              <button
                key={`${g}-${i}`}
                role="tab"
                aria-selected={i === photo}
                className={cn('im-thumb', i === photo && 'on')}
                onClick={() => setPhoto(i)}
              >
                <img src={asset(g)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="im-body">
        <div className="im-scroll">
          {item.tags?.length > 0 && (
            <div className="im-tags">{item.tags.map((t) => <span key={t} className={cn('tag', t.replace(/\s+/g, '-'))}>{t}</span>)}</div>
          )}
          <h3 id="im-title" className="disp">{item.name}</h3>
          <p className="im-desc">
            {item.desc}
            {item.serves ? ` Serves ${item.serves}.` : ''}
          </p>
          <div className="im-meta">
            {item.prepMins ? <span><Icon name="clock" size={13} /> ~{item.prepMins} min</span> : null}
            {item.spice > 0 && <span className="spice">{'🌶'.repeat(Math.min(3, item.spice))}</span>}
            {item.veg && <span className="veg-tag"><Icon name="leaf" size={12} /> Veg</span>}
          </div>

          {(item.opts || []).map((g, gi) => (
            <div className="og" key={g.id}>
              <div className="ogh">
                <b>{g.group}</b>
                <span className={g.required ? 'req' : 'opt'}>{g.required ? 'Required' : 'Optional'}</span>
              </div>
              {g.choices.map((c) => {
                const on = (sel[gi] || []).includes(c.id)
                return (
                  <button key={c.id} type="button" className={cn('choice', on && 'on')} onClick={() => toggle(gi, c.id)}>
                    <span className={cn('rd', g.multi && 'sq')} />
                    <span className="cn">{c.n}</span>
                    <em>{g.required && c.p === item.price ? '' : g.required ? rs(c.p) : `+ ${rs(c.p)}`}</em>
                  </button>
                )
              })}
            </div>
          ))}

          <label className="field">
            <span className="flabel">Special instructions</span>
            <textarea rows={2} placeholder="e.g. less spicy, no onions" value={note} maxLength={200}
              onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

        <div className="im-bottom">
          <div className="step">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less"><Icon name="minus" size={14} stroke={2.6} /></button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="More"><Icon name="plus" size={14} stroke={2.6} /></button>
          </div>
          <button className="btn y grow" disabled={missing}
            onClick={() => { addToCart(item, choices, qty, note.trim()); onClose() }}>
            <span>{missing ? 'Choose options' : 'Add to bag'}</span>
            <span>{rs(unit * qty)}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* -------------------------------- deal card ----------------------------- */

export function DealCard({ item, big, onOpen }) {
  return (
    <article className={cn('deal', big && 'big', !item.available && 'off')} onClick={() => onOpen?.(item)}>
      <img src={asset(item.img)} alt="" loading="lazy" />
      {item.was && <div className="save">Save {rs(item.was - item.price)}</div>}
      <div className="in">
        <div className="serves">Serves {item.serves || 2}</div>
        <h3>{item.name}</h3>
        <p>{item.desc}</p>
        <div className="row">
          <div className="price">{rs(item.price)}{item.was && <s>{rs(item.was)}</s>}</div>
          <div className="addround"><Icon name="plus" size={16} stroke={2.6} /></div>
        </div>
      </div>
    </article>
  )
}

/* ------------------------------ review card ----------------------------- */

export function ReviewCard({ review }) {
  return (
    <figure className="review">
      <Stars value={review.rating} />
      <blockquote>{review.body}</blockquote>
      <figcaption>
        <span className="avatar">{review.name.slice(0, 1).toUpperCase()}</span>
        <span>
          <b>{review.name}</b>
          <small>Verified visit · {new Date(review.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}</small>
        </span>
      </figcaption>
    </figure>
  )
}
