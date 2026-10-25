import { useEffect, useMemo, useState } from 'react'
import { Link } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, Stars, Field, StarPicker, Spinner, Empty } from '../ui.jsx'
import { api } from '../lib/api.js'
import { asset, cn, rs, dayOptions, TIMES } from '../lib/utils.js'
import { ReviewCard } from './components.jsx'

/* ================================ ABOUT ================================= */

export function About() {
  const { settings: s = {}, menu } = useApp()
  const cuisines = ['Pakistani', 'Chinese', 'BBQ', 'Fast food']

  const gallery = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const m of menu) {
      const key = m.img
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ src: m.img, alt: m.name })
      if (out.length >= 8) break
    }
    return out
  }, [menu])

  return (
    <>
      <section className="page-hero">
        <video src="/assets/hero-smoke.mp4" autoPlay muted loop playsInline />
        <div className="wrap">
          <div className="eb on-dark">Since day one · New College Road</div>
          <h1 className="disp">Our story</h1>
          <p className="lede">
            One kitchen, four counters, and a single idea — Taunsa deserves a place where the whole
            family finds their favourite on the same table.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap split">
          <div>
            <div className="eb">The idea</div>
            <h2 className="disp">Four kitchens.<br />One joy.</h2>
            <p>
              Foodeez began as a small takeaway counter with a charcoal grill and a single fryer.
              The plan was simple: cook the things people in Taunsa actually crave — desi karahi,
              charcoal BBQ, Chinese wok classics and a proper zinger — and cook them properly,
              every single time.
            </p>
            <p>
              Today the same kitchen runs four sections under one roof. Chicken arrives fresh each
              morning. Marinades are mixed in-house, never bottled. The coal is lit every evening
              around five, and that smoke is the flavour you can taste in every boti.
            </p>
            <p>
              The family hall seats large groups with a separate entrance, and our own riders cover
              the city so your food arrives hot — without an aggregator taking a cut.
            </p>
            <div className="btn-row">
              <Link to="/menu" className="btn y">See the menu</Link>
              <Link to="/contact" className="btn o">Find us</Link>
            </div>
          </div>
          <div className="piliers">
            {[
              ['Charcoal, every evening', 'Real coal, real smoke. That is the flavour you cannot fake in an oven.'],
              ['Fresh chicken daily', 'Bought every morning from the same supplier. Never frozen overnight.'],
              ['Made to order', 'Nothing sits under a lamp. Your order starts when it reaches the kitchen screen.'],
              ['Family hall', 'Separate seating, clean washrooms, room for twenty at one table.'],
            ].map(([t, d]) => (
              <div className="piliers-item" key={t}>
                <b>{t}</b>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec alt">
        <div className="wrap">
          <div className="sec-h">
            <div><div className="eb">From our kitchen</div><h2 className="disp">A look inside</h2></div>
            <p>{cuisines.join(' · ')} — {menu.length} dishes on the live menu right now.</p>
          </div>
          <div className="gallery">
            {gallery.map((g, i) => (
              <figure key={g.src + i} className={cn('gal', i % 5 === 0 && 'wide')}>
                <img src={asset(g.src)} alt={g.alt} loading="lazy" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="sec dark">
        <div className="wrap">
          <div className="sec-h">
            <div><div className="eb">By the numbers</div><h2 className="disp">Why people come back</h2></div>
          </div>
          <div className="stats4">
            <div><b>{menu.length}</b><span>dishes on the menu</span></div>
            <div><b>{s.eta || 35}<small>min</small></b><span>average delivery</span></div>
            <div><b>{s.radiusKm || 6}<small>km</small></b><span>delivery radius</span></div>
            <div><b>{s.hours?.split('–')[1]?.trim() || '1 AM'}</b><span>kitchen closes</span></div>
          </div>
        </div>
      </section>
    </>
  )
}

/* ================================ REVIEWS =============================== */

export function Reviews() {
  const { boot, refresh, toast } = useApp()
  const [reviews, setReviews] = useState(boot?.reviews || [])
  const [summary, setSummary] = useState(boot?.reviewSummary || { count: 0, average: 0 })
  const [form, setForm] = useState({ name: '', rating: 5, body: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    api.get('/reviews').then((d) => { setReviews(d.reviews); setSummary(d.summary) }).catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (form.name.trim().length < 2) return toast('Please add your name', 'err')
    if (form.body.trim().length < 4) return toast('Tell us a little more', 'err')
    setBusy(true)
    try {
      await api.post('/reviews', form)
      setSent(true)
      setForm({ name: '', rating: 5, body: '' })
      toast('Thanks! Your review is with the team for approval.')
    } catch (err) {
      toast(err.message, 'err')
    } finally { setBusy(false) }
  }

  const dist = useMemo(() => {
    const d = [0, 0, 0, 0, 0]
    for (const r of reviews) d[r.rating - 1]++
    return d
  }, [reviews])

  return (
    <>
      <section className="page-head wrap">
        <div className="eb">Straight from the table</div>
        <h1 className="disp">Reviews</h1>
        <p>Every review here comes from a real order or visit. We do not delete the bad ones.</p>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap reviews-layout">
          <div>
            <div className="rating-panel">
              <div className="rp-score">
                <b>{summary.average ? summary.average.toFixed(1) : '—'}</b>
                <Stars value={summary.average} size={17} />
                <small>{summary.count} review{summary.count === 1 ? '' : 's'}</small>
              </div>
              <div className="rp-bars">
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = dist[star - 1]
                  const pct = reviews.length ? (n / reviews.length) * 100 : 0
                  return (
                    <div className="rp-bar" key={star}>
                      <span>{star}</span>
                      <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                      <span className="n">{n}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {reviews.length === 0
              ? <Empty icon="message" title="No reviews yet">Be the first to tell Taunsa how it went.</Empty>
              : <div className="reviews one-col">{reviews.map((r) => <ReviewCard key={r.id} review={r} />)}</div>}
          </div>

          <aside className="blk review-form">
            <h3 className="disp">Leave a review</h3>
            <p>Did you order or visit? We read every one.</p>
            {sent ? (
              <div className="sent-note">
                <Icon name="check" size={16} stroke={3} />
                <b>Thank you</b>
                <span>Your review is waiting for approval and will appear shortly.</span>
                <button className="linkbtn" onClick={() => setSent(false)}>Write another</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <Field label="Your name">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="How should we call you?" maxLength={60} />
                </Field>
                <div className="field">
                  <span className="flabel">Your rating</span>
                  <StarPicker value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
                </div>
                <Field label="Your review">
                  <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder="What did you order? How was it?" maxLength={800} />
                </Field>
                <button className="btn y wide" disabled={busy}>{busy ? 'Sending…' : 'Post review'}</button>
              </form>
            )}
          </aside>
        </div>
      </section>
    </>
  )
}

/* ================================ RESERVE =============================== */

export function Reserve() {
  const { settings: s = {}, user, toast } = useApp()
  const days = useMemo(dayOptions, [])
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '', guests: 4,
    day: days[0].value, time: '8:00 PM', note: '',
  })
  const [slots, setSlots] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setSlots(null)
    if (!form.day || !form.time) return
    api.get(`/reservations/slots?day=${encodeURIComponent(form.day)}&time=${encodeURIComponent(form.time)}`)
      .then(setSlots).catch(() => setSlots(null))
  }, [form.day, form.time])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.name.trim().length < 2) return setError('Please enter your name')
    if (!/^(\+92|0)3\d{2}[\s-]?\d{7}$/.test(form.phone.trim())) return setError('Enter a valid mobile number, e.g. 0333 1234567')
    setBusy(true)
    try {
      const { reservation } = await api.post('/reservations', form)
      setDone(reservation)
      toast('Table request sent — we will call to confirm')
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="wrap page-pad">
        <div className="confirm-card">
          <span className="confirm-icon"><Icon name="check" size={26} stroke={3} /></span>
          <h1 className="disp">Table requested</h1>
          <p>We have your request for <b>{done.guests} guests</b> on <b>{done.day}</b> at <b>{done.time}</b>.</p>
          <p className="muted">Reference <b className="mono">{done.id}</b> · We confirm by phone within the hour during opening times.</p>
          <div className="btn-row center">
            <Link to="/menu" className="btn y">See the menu</Link>
            <button className="btn o" onClick={() => setDone(null)}>Book another</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="page-head wrap">
        <div className="eb">Dine in with us</div>
        <h1 className="disp">Book a table</h1>
        <p>Family hall, rooftop and indoor seating. We hold tables for 15 minutes past the booking time.</p>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap reserve-layout">
          <form className="blk reserve-form" onSubmit={submit}>
            <div className="row2">
              <Field label="Name">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" autoComplete="name" />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0333 1234567" inputMode="tel" autoComplete="tel" />
              </Field>
            </div>
            <div className="row3">
              <Field label="Guests">
                <select value={form.guests} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Day">
                <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                  {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </Field>
              <Field label="Time">
                <select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}>
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Anything we should know?">
              <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Birthday, high chair, quiet corner…" maxLength={300} />
            </Field>

            {slots && (
              <div className={cn('slot-note', slots.available < (form.guests || 0) && 'bad')}>
                <Icon name={slots.available < (form.guests || 0) ? 'alert' : 'check'} size={14} stroke={2.6} />
                {slots.available === 0
                  ? 'That sitting is fully booked — pick another time.'
                  : `${slots.available} of ${slots.capacity} seats left for this sitting.`}
              </div>
            )}
            {error && <div className="warn">{error}</div>}

            <button className="btn y wide tall" disabled={busy || (slots && slots.available < form.guests)}>
              {busy ? 'Sending…' : 'Request table'} <Icon name="arrow" size={16} />
            </button>
          </form>

          <aside className="panel yellow reserve-aside">
            <h3 className="disp">Good to know</h3>
            <ul className="ticks">
              <li><Icon name="clock" size={14} stroke={3} /> Open daily · {s.hours}</li>
              <li><Icon name="users" size={14} stroke={3} /> Groups up to 30 in the family hall</li>
              <li><Icon name="phone" size={14} stroke={3} /> Confirmed by phone: {s.phone2}</li>
              <li><Icon name="pin" size={14} stroke={3} /> {s.address}</li>
            </ul>
            <p className="muted">For events larger than 30, call us directly and ask for the manager.</p>
            <a className="btn k wide" href={`tel:${(s.phone2 || '').replace(/\s/g, '')}`}>
              <Icon name="phone" size={15} /> Call {s.phone2}
            </a>
          </aside>
        </div>
      </section>
    </>
  )
}

/* ================================ CONTACT =============================== */

export function Contact() {
  const { settings: s = {}, toast } = useApp()
  const [form, setForm] = useState({ name: '', phone: '', message: '' })

  const send = (e) => {
    e.preventDefault()
    if (form.name.trim().length < 2 || form.message.trim().length < 5) return toast('Please add your name and a message', 'err')
    toast('Thanks — the team will call you back')
    setForm({ name: '', phone: '', message: '' })
  }

  return (
    <>
      <section className="page-head wrap">
        <div className="eb">We are on New College Road</div>
        <h1 className="disp">Contact & visit</h1>
        <p>Call for delivery, bookings or a large order. We answer between {s.hours}.</p>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap contact-grid">
          <div className="blk">
            <dl className="kv">
              <dt>Address</dt><dd>{s.address}</dd>
              <dt>Delivery</dt><dd><a href={`tel:${(s.phone1 || '').replace(/\s/g, '')}`}>{s.phone1}</a></dd>
              <dt>Bookings</dt><dd><a href={`tel:${(s.phone2 || '').replace(/\s/g, '')}`}>{s.phone2}</a></dd>
              <dt>Hours</dt><dd>Every day · {s.hours}</dd>
              <dt>Email</dt><dd>{s.email || 'hello@foodeez.pk'}</dd>
              <dt>Delivery area</dt><dd>Within {s.radiusKm || 6} km · fee {rs(s.deliveryFee || 0)}, free over {rs(s.freeDeliveryOver || 2500)}</dd>
            </dl>
            <div className="map tall">
              <div className="road" style={{ left: 0, right: 0, top: '58%', height: 20 }} />
              <div className="road" style={{ top: 0, bottom: 0, left: '30%', width: 16 }} />
              <div className="road" style={{ top: 0, bottom: 0, left: '78%', width: 10 }} />
              <span className="lbl" style={{ left: 14, top: 'calc(58% + 26px)' }}>New College Road</span>
              <span className="lbl" style={{ left: 'calc(30% + 22px)', top: 12 }}>Govt Degree College →</span>
              <div className="pin"><img src="/assets/logo.png" alt="" /></div>
            </div>
            <div className="btn-row">
              <Link to="/menu" className="btn y">Order online</Link>
              <Link to="/reserve" className="btn o">Book a table</Link>
            </div>
          </div>

          <aside className="blk">
            <h3 className="disp">Send a message</h3>
            <p>For catering, feedback or anything else. We reply during opening hours.</p>
            <form onSubmit={send}>
              <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></Field>
              <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0333 1234567" inputMode="tel" /></Field>
              <Field label="Message"><textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How can we help?" maxLength={600} /></Field>
              <button className="btn y wide">Send message</button>
            </form>
          </aside>
        </div>
      </section>
    </>
  )
}

/* ================================== FAQ ================================= */

const FAQS = [
  ['How long does delivery take?', 'Around 30–40 minutes across Taunsa city. You get a live tracker once the kitchen accepts your order, and the rider calls before arriving.'],
  ['What is the delivery area and fee?', 'We deliver within about 6 km of New College Road. Delivery is Rs 100 and free on orders over Rs 2,500. Pickup is always free.'],
  ['Can I pay by card or mobile wallet?', 'Cash on delivery, JazzCash and easypaisa are accepted today. You will get a payment request on your number once we accept the order.'],
  ['Is there a minimum order?', 'Yes — Rs 500 for delivery and pickup. The bag will tell you exactly how much more is needed.'],
  ['Do you cater for large groups?', 'The family hall seats up to 40 across a sitting. Book online or call the bookings number, and for events larger than 30 call and ask for the manager.'],
  ['How do I cancel an order?', 'Open your tracking link and cancel while the status is still “Order placed” or “In the kitchen”. After dispatch, please call us.'],
  ['Are all dishes halal?', 'Everything we serve is halal. Chicken is bought fresh each morning and marinades are made in-house.'],
  ['Do you have vegetarian options?', 'Yes — use the Veg filter on the menu. Cheese Lover pizza, Masala Fries, naan and shakes are all vegetarian.'],
]

export function FAQ() {
  return (
    <section className="sec alt" id="faq">
      <div className="wrap">
        <div className="sec-h">
          <div><div className="eb">Before you order</div><h2 className="disp">Questions</h2></div>
          <p>The things customers ask us most on the phone. If yours is not here, call us.</p>
        </div>
        <div className="faq">
          {FAQS.map(([q, a]) => (
            <details key={q} className="faq-item">
              <summary>{q}<span className="faq-plus" aria-hidden="true" /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================================ 404 =================================== */

export function NotFound() {
  return (
    <div className="wrap page-pad">
      <Empty icon="alert" title="Page not found" action={<Link to="/" className="btn y">Back to home</Link>}>
        That link does not exist any more.
      </Empty>
    </div>
  )
}
