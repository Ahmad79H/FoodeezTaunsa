import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, Empty } from '../ui.jsx'
import { cn, rs } from '../lib/utils.js'
import { ItemCard, ItemModal } from './components.jsx'

export default function MenuPage({ search }) {
  const { menu, categories, boot, cart: cartLines } = useApp()
  const { navigate } = useRouter()
  const params = new URLSearchParams(search)
  const initialCat = params.get('cat') || 'all'

  const [cat, setCat] = useState(initialCat)
  const [q, setQ] = useState('')
  const [vegOnly, setVegOnly] = useState(false)
  const [spicyOnly, setSpicyOnly] = useState(false)
  const [open, setOpen] = useState(null)
  const [active, setActive] = useState(initialCat)
  const barRef = useRef(null)

  useEffect(() => { setCat(initialCat) }, [initialCat])

  const ql = q.trim().toLowerCase()

  const visible = useMemo(() => menu.filter((m) => {
    if (vegOnly && !m.veg) return false
    if (spicyOnly && !(m.spice > 0)) return false
    if (!ql) return true
    return (m.name + ' ' + m.desc).toLowerCase().includes(ql)
  }), [menu, vegOnly, spicyOnly, ql])

  const groups = useMemo(() => {
    const list = cat === 'all' ? categories : categories.filter((c) => c.id === cat)
    return list
      .map((c) => ({ ...c, items: visible.filter((m) => m.cat === c.id) }))
      .filter((g) => g.items.length > 0)
  }, [categories, visible, cat])

  const total = visible.length
  const qtyMap = useMemo(() => {
    const m = new Map()
    for (const l of cartLines) m.set(l.itemId, (m.get(l.itemId) || 0) + l.qty)
    return m
  }, [cartLines])

  const pick = (id) => {
    setCat(id)
    setActive(id)
    const url = id === 'all' ? '/menu' : `/menu?cat=${id}`
    navigate(url, { scroll: false })
    barRef.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }

  return (
    <div className="menu-page">
      <div className="menu-toolbar">
        <div className="wrap">
          <div className="cats" ref={barRef}>
            <button className={cn(cat === 'all' && 'on')} onClick={() => pick('all')}>
              Everything <small>{menu.length}</small>
            </button>
            {categories.map((c) => (
              <button key={c.id} className={cn(cat === c.id && 'on')} onClick={() => pick(c.id)}>
                {c.name} <small>{visible.filter((m) => m.cat === c.id).length}</small>
              </button>
            ))}
          </div>
          <div className="filters">
            <label className="search">
              <Icon name="search" size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search karahi, zinger, pizza…" aria-label="Search menu" />
              {q && <button onClick={() => setQ('')} aria-label="Clear"><Icon name="close" size={14} /></button>}
            </label>
            <button className={cn('chipbtn', vegOnly && 'on')} onClick={() => setVegOnly((v) => !v)}>
              <Icon name="leaf" size={13} /> Veg
            </button>
            <button className={cn('chipbtn', spicyOnly && 'on')} onClick={() => setSpicyOnly((v) => !v)}>
              <Icon name="fire" size={13} /> Spicy
            </button>
          </div>
        </div>
      </div>

      <div className="wrap menu-body">
        <header className="page-head">
          <div className="eb">Pakistani · Chinese · BBQ · Fast food</div>
          <h1 className="disp">{cat === 'all' ? 'The menu' : categories.find((c) => c.id === cat)?.name}</h1>
          <p>Everything cooked to order. Prices include tax. {total} dish{total === 1 ? '' : 'es'} available right now.</p>
        </header>

        {total === 0 && (
          <Empty icon="search" title="Nothing matches that">
            Try “tikka”, “pizza” or clear the filters.
          </Empty>
        )}

        {groups.map((g) => (
          <section className="cat-block" key={g.id} id={`cat-${g.id}`}>
            <h2 className="disp cat-title">
              {g.name}
              <span className="ur">{g.ur}</span>
              <small>{g.items.length}</small>
            </h2>
            <div className="items">
              {g.items.map((item) => (
                <ItemCard key={item.id} item={item} qtyInCart={qtyMap.get(item.id) || 0} onOpen={setOpen} />
              ))}
            </div>
          </section>
        ))}

        {boot?.promos?.length > 0 && (
          <div className="promo-strip">
            <Icon name="tag" size={18} />
            <div>
              <b>Running offers</b>
              <span>
                {boot.promos.map((p) => `${p.code} — ${p.type === 'pct' ? `${p.value}% off` : `Rs ${p.value} off`}`).join(' · ')}
              </span>
            </div>
          </div>
        )}
      </div>

      <ItemModal item={open} onClose={() => setOpen(null)} />
    </div>
  )
}
