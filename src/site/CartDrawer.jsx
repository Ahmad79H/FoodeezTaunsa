import { useEffect, useState } from 'react'
import { Link, useRouter } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, useBodyLock } from '../ui.jsx'
import { asset, cn, rs } from '../lib/utils.js'

export default function CartDrawer({ open, onClose }) {
  const { cart, cartSubtotal, setQty, removeLine, clearCart, settings: s = {}, user } = useApp()
  const { navigate } = useRouter()
  const [code, setCode] = useState('')
  const [promo, setPromo] = useState(null)
  const [promoErr, setPromoErr] = useState('')

  useBodyLock(open)

  useEffect(() => { if (!open) { setPromoErr('') } }, [open])

  const freeOver = s.freeDeliveryOver || 2500
  const freeDelivery = cartSubtotal >= freeOver
  const minOrder = s.minOrder || 0
  const belowMin = cartSubtotal > 0 && cartSubtotal < minOrder
  const left = Math.max(0, freeOver - cartSubtotal)

  const apply = (e) => {
    e?.preventDefault?.()
    const c = code.trim().toUpperCase()
    if (!c) return
    if (promo?.code === c) return
    // validated again by the server at checkout; this is a UX preview
    setPromoErr('')
    setPromo({ code: c, pending: true })
    fetch('/api/promo/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: c, subtotal: cartSubtotal }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPromo({ code: d.code, discount: d.discount })
        else { setPromo(null); setPromoErr(d.error || 'Code not valid') }
      })
      .catch(() => { setPromo(null); setPromoErr('Could not check that code') })
  }

  if (!open) return null

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Your bag">
        <header>
          <h3 className="disp">Your bag</h3>
          <button className="x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </header>

        <div className="d-scroll">
          {cart.length === 0 ? (
            <div className="empty">
              <img src="/assets/logo.png" alt="" className="empty-logo" />
              <b>Hungry yet?</b>
              <p>Your bag is empty. Start with a Zinger.</p>
              <button className="btn k" onClick={() => { onClose(); navigate('/menu') }}>Browse the menu</button>
            </div>
          ) : (
            <>
              <div className="prog">
                {freeDelivery
                  ? <><b>Free delivery unlocked</b> on this order</>
                  : <>Add <b>{rs(left)}</b> more for <b>free delivery</b></>}
                <div className="bar"><i style={{ width: `${Math.min(100, (cartSubtotal / freeOver) * 100)}%` }} /></div>
              </div>

              {cart.map((l) => (
                <div className="line" key={l.key}>
                  <img src={asset(l.img)} alt="" />
                  <div className="line-main">
                    <b>{l.name}</b>
                    {l.opts && <small>{l.opts}</small>}
                    {l.note && <small className="line-note">“{l.note}”</small>}
                    <div className="step sm">
                      <button onClick={() => setQty(l.key, l.qty - 1)} aria-label="Less"><Icon name="minus" size={12} stroke={2.6} /></button>
                      <span>{l.qty}</span>
                      <button onClick={() => setQty(l.key, l.qty + 1)} aria-label="More"><Icon name="plus" size={12} stroke={2.6} /></button>
                    </div>
                  </div>
                  <div className="line-right">
                    <span>{rs(l.unit * l.qty)}</span>
                    <button className="trash" onClick={() => removeLine(l.key)} aria-label={`Remove ${l.name}`}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <form className="promo" onSubmit={apply}>
                <input placeholder="Promo code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Promo code" />
                <button className="btn k sm" type="submit">Apply</button>
              </form>
              {promoErr && <div className="promo-msg err">{promoErr}</div>}
              {promo && !promo.pending && (
                <div className="promo-msg ok">{promo.code} applied — you save {rs(promo.discount)}</div>
              )}

              <button className="linkbtn" onClick={clearCart}>Empty the bag</button>
            </>
          )}
        </div>

        {cart.length > 0 && (
          <footer>
            <div className="sum"><span>Subtotal</span><span>{rs(cartSubtotal)}</span></div>
            <div className="sum"><span>Delivery</span><span>{freeDelivery ? 'Free' : rs(s.deliveryFee || 0)}</span></div>
            <div className="sum tot"><span>Total</span><span>{rs(cartSubtotal + (freeDelivery ? 0 : (s.deliveryFee || 0)))}</span></div>
            {belowMin && <div className="warn">Minimum order is {rs(minOrder)}</div>}
            {!user && (
              <p className="d-signin">
                You will need an account to check out — it takes a few seconds and keeps your
                bag.
              </p>
            )}
            <button
              className="btn y wide"
              disabled={belowMin || s.open === false || s.acceptingOrders === false}
              onClick={() => { onClose(); navigate(user ? '/checkout' : '/login?next=/checkout') }}
            >
              <span>
                {s.open === false ? 'Closed right now'
                  : s.acceptingOrders === false ? 'Not taking orders'
                  : !user ? 'Sign in to checkout'
                  : 'Checkout'}
              </span>
              <Icon name="arrow" size={16} />
            </button>
            <Link to="/menu" className="d-continue" onClick={onClose}>Add more items</Link>
          </footer>
        )}
      </aside>
    </>
  )
}
