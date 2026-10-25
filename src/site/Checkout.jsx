import { useEffect, useMemo, useState } from 'react'
import { Link, useRouter } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, Field, Empty } from '../ui.jsx'
import { api } from '../lib/api.js'
import { asset, cn, rs } from '../lib/utils.js'

const PAYMENTS = [
  { id: 'cod', label: 'Cash', note: 'Pay on delivery / at counter' },
  { id: 'jazzcash', label: 'JazzCash', note: 'Mobile wallet request' },
  { id: 'easypaisa', label: 'easypaisa', note: 'Mobile wallet request' },
]

export default function Checkout() {
  const { cart, cartSubtotal, settings: s = {}, user, clearCart, rememberTicket, toast } = useApp()
  const { navigate } = useRouter()

  const [type, setType] = useState('delivery')
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '',
    address: user?.address || '', landmark: '', note: '',
  })
  const [pay, setPay] = useState('cod')
  const [code, setCode] = useState('')
  const [promo, setPromo] = useState(null)
  const [promoErr, setPromoErr] = useState('')
  const [errs, setErrs] = useState({})
  const [busy, setBusy] = useState(false)
  const [serverErr, setServerErr] = useState('')

  useEffect(() => {
    if (user?.name) setForm((f) => ({ ...f, name: user.name, phone: user.phone || f.phone, address: user.address || f.address }))
  }, [user])

  const fee = type === 'pickup' ? 0 : (cartSubtotal >= (s.freeDeliveryOver || 2500) ? 0 : (s.deliveryFee || 0))
  const discount = promo?.discount || 0
  const total = Math.max(0, cartSubtotal - discount + fee)
  const belowMin = cartSubtotal < (s.minOrder || 0)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const applyPromo = async () => {
    const c = code.trim().toUpperCase()
    if (!c) return
    setPromoErr('')
    try {
      const d = await api.post('/promo/validate', { code: c, subtotal: cartSubtotal })
      if (d.ok) setPromo({ code: d.code, discount: d.discount })
      else { setPromo(null); setPromoErr(d.error) }
    } catch {
      setPromo(null); setPromoErr('Could not check that code')
    }
  }

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = 'Please enter your name'
    const phoneClean = form.phone.trim().replace(/[^\d+]/g, '').replace(/^(\+92|0092|92)/, '0')
    if (!/^03\d{9}$/.test(phoneClean)) e.phone = 'Enter a valid mobile number, e.g. 0333 1234567'
    if (type === 'delivery' && form.address.trim().length < 6) e.address = 'We need a full address to deliver'
    setErrs(e)
    return Object.keys(e).length === 0
  }

  const place = async () => {
    setServerErr('')
    if (!validate()) return
    setBusy(true)
    try {
      const payload = {
        type,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        landmark: form.landmark.trim(),
        note: form.note.trim(),
        payMethod: type === 'pickup' && pay === 'cod' ? 'cod' : pay,
        promoCode: promo?.code || null,
        lines: cart.map((l) => ({ itemId: l.itemId, qty: l.qty, choices: l.choices, note: l.note || '' })),
      }
      const { order, trackToken } = await api.post('/orders', payload)
      rememberTicket(order.id, trackToken)
      clearCart()
      toast(`Order ${order.id} placed`)
      navigate(`/track/${order.id}?t=${trackToken}`)
    } catch (e) {
      setServerErr(e.message)
      setBusy(false)
    }
  }

  if (cart.length === 0) {
    return (
      <div className="wrap page-pad">
        <Empty icon="bag" title="Your bag is empty" action={<Link to="/menu" className="btn y">Browse the menu</Link>}>
          Add something delicious first.
        </Empty>
      </div>
    )
  }

  /*
   * Ordering needs an account: it is how the customer gets their order history,
   * loyalty points and live tracking back afterwards. Send them to sign in and
   * straight back here — the bag is kept in localStorage, so nothing is lost.
   */
  if (user === null) {
    return (
      <div className="wrap page-pad">
        <div className="blk narrow need-account">
          <img src="/assets/logo.png" alt="" />
          <h2 className="disp">Sign in to order</h2>
          <p className="muted">
            Your bag is saved. Sign in — or create an account in a few seconds — and you
            will come straight back to checkout.
          </p>
          <div className="btn-row">
            <Link to="/login?next=/checkout" className="btn y">Sign in</Link>
            <Link to="/register?next=/checkout" className="btn o">Create account</Link>
          </div>
          <p className="muted small">Why an account? So you can follow the order live and keep your points.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ck">
      <div className="ck-top">
        <div className="wrap">
          <Link to="/menu" className="roundbtn" aria-label="Back"><Icon name="back" size={18} /></Link>
          <div className="brand"><img src="/assets/logo.png" alt="" /><b>FOODEEZ</b></div>
          <div className="ck-steps"><span>Bag</span><span>›</span><span className="on">Checkout</span><span>›</span><span>Track</span></div>
        </div>
      </div>

      <div className="wrap ck-grid">
        <div>
          <h1 className="disp">Almost there</h1>

          <section className="blk">
            <h4><i>1</i>How do you want it?</h4>
            <div className="seg">
              <button className={cn(type === 'delivery' && 'on')} onClick={() => setType('delivery')}>
                <b>Delivery</b>
                <small>{s.eta || 35}–{(s.eta || 35) + 10} min · within {s.radiusKm || 6} km</small>
              </button>
              <button className={cn(type === 'pickup' && 'on')} onClick={() => setType('pickup')}>
                <b>Pickup</b>
                <small>Ready in ~20 min · New College Road</small>
              </button>
            </div>
          </section>

          <section className="blk">
            <h4><i>2</i>Your details</h4>
            <div className="row2">
              <Field label="Full name" error={errs.name}>
                <input value={form.name} onChange={set('name')} placeholder="Your name" autoComplete="name" />
              </Field>
              <Field label="Mobile number" error={errs.phone}>
                <input value={form.phone} onChange={set('phone')} placeholder="0333 1234567" inputMode="tel" autoComplete="tel" />
              </Field>
            </div>
            {type === 'delivery' && (
              <>
                <Field label="Delivery address" error={errs.address}>
                  <input value={form.address} onChange={set('address')} placeholder="House #, street, mohalla" autoComplete="street-address" />
                </Field>
                <Field label="Nearest landmark (optional)">
                  <input value={form.landmark} onChange={set('landmark')} placeholder="e.g. Govt Degree College, Ghulam Haider Chowk" />
                </Field>
              </>
            )}
            <Field label="Note for the kitchen / rider">
              <input value={form.note} onChange={set('note')} placeholder="Ring the bell twice" maxLength={300} />
            </Field>
            {!user && (
              <p className="hint-line">
                Want your order history saved? <Link to="/register">Create an account</Link> — or continue as guest.
              </p>
            )}
          </section>

          <section className="blk">
            <h4><i>3</i>Payment</h4>
            <div className="pay">
              {PAYMENTS.map((p) => (
                <button key={p.id} className={cn(pay === p.id && 'on')} onClick={() => setPay(p.id)}>
                  <b>{p.label}</b><small>{p.note}</small>
                </button>
              ))}
            </div>
            {pay !== 'cod' && (
              <p className="hint-line">
                You'll get a payment request on {form.phone || 'your number'} after we accept the order.
              </p>
            )}
          </section>
        </div>

        <aside className="summary">
          <div className="blk">
            <h4 className="sum-head">Order summary</h4>
            {cart.map((l) => (
              <div className="mini" key={l.key}>
                <img src={asset(l.img)} alt="" />
                <div><b>{l.qty}× {l.name}</b>{l.opts && <small>{l.opts}</small>}</div>
                <span>{rs(l.unit * l.qty)}</span>
              </div>
            ))}

            <div className="promo-row">
              <input placeholder="Promo code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button className="btn k sm" onClick={applyPromo}>Apply</button>
            </div>
            {promoErr && <div className="promo-msg err">{promoErr}</div>}
            {promo && <div className="promo-msg ok">{promo.code} applied</div>}

            <div className="sum"><span>Subtotal</span><span>{rs(cartSubtotal)}</span></div>
            {discount > 0 && <div className="sum disc"><span>Discount</span><span>− {rs(discount)}</span></div>}
            <div className="sum"><span>{type === 'pickup' ? 'Pickup' : 'Delivery'}</span><span>{fee ? rs(fee) : 'Free'}</span></div>
            <div className="sum tot"><span>Total</span><span>{rs(total)}</span></div>

            {belowMin && <div className="warn">Minimum order is {rs(s.minOrder)}</div>}
            {serverErr && <div className="warn">{serverErr}</div>}

            <button className="btn y wide tall" onClick={place} disabled={busy || belowMin}>
              <span>{busy ? 'Placing order…' : 'Place order'}</span>
              <span>{rs(total)}</span>
            </button>

            <p className="ck-fine">
              Questions? Call <b>{s.phone1}</b>. We confirm every order by phone.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
