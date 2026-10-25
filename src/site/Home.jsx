import { useMemo, useState } from 'react'
import { Link } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon, Stars } from '../ui.jsx'
import { asset, cn, rs } from '../lib/utils.js'
import { DealCard, ItemCard, ItemModal, ReviewCard } from './components.jsx'

export default function Home() {
  const { boot, settings: s = {}, menu, categories, user } = useApp()
  const [open, setOpen] = useState(null)

  const featured = boot?.featured || []
  const deals = boot?.deals || []
  const reviews = boot?.reviews || []
  const summary = boot?.reviewSummary || { count: 0, average: 0 }

  const counts = useMemo(() => {
    const m = new Map()
    for (const item of menu) m.set(item.cat, (m.get(item.cat) || 0) + 1)
    return m
  }, [menu])

  const openCount = s.open !== false && s.acceptingOrders !== false
  const dishCount = menu.length

  return (
    <>
      {/* ------------------------------- hero ------------------------------ */}
      <header className="hero" id="top">
        <video src="/assets/hero-fire.mp4" autoPlay muted loop playsInline preload="metadata" />
        <div className="shade" />
        <div className="wrap">
          <div className="hero-copy">
            <span className="kick">
              <span className={cn('status-dot', !openCount && 'closed')} />
              {openCount ? `Delivering in ${s.eta || 35} min` : 'Closed — browse the menu'} · Taunsa Sharif
            </span>
            <h1 className="disp">Taste<em>the joy.</em></h1>
            <p className="sub">
              Charcoal BBQ, crackling broast, karahi off the high flame and zingers that crunch —
              made fresh on New College Road, every single day.
              <span className="ur">ذائقہ جو دل خوش کر دے</span>
            </p>
            <div className="ctas">
              <Link to="/menu" className="btn y">Order now <Icon name="arrow" size={16} /></Link>
              <Link to="/menu?cat=deals" className="btn ghost">See deals</Link>
              {!user && <Link to="/register" className="btn ghost">Create account</Link>}
            </div>
            {summary.count > 0 && (
              <div className="hero-rating">
                <Stars value={summary.average} size={16} />
                <b>{summary.average.toFixed(1)}</b>
                <span>from {summary.count} review{summary.count === 1 ? '' : 's'}</span>
              </div>
            )}
          </div>

          <div className="logo-big">
            <img src="/assets/logo.png" alt="Foodeez" />
          </div>
        </div>

        <div className="facts">
          <div className="wrap">
            <div className="f"><b>{s.eta || 35} min</b><small>Avg delivery</small></div>
            <div className="f"><b>{dishCount}</b><small>Dishes, 4 cuisines</small></div>
            <div className="f"><b>{s.hours || '12 PM – 1 AM'}</b><small>Open daily</small></div>
            <div className="f"><b>Free</b><small>Delivery over {rs(s.freeDeliveryOver || 2500)}</small></div>
          </div>
        </div>
      </header>

      <Marquee />

      {/* ------------------------------- deals ----------------------------- */}
      {deals.length > 0 && (
        <section className="sec" id="deals">
          <div className="wrap">
            <div className="sec-h">
              <div>
                <div className="eb">Feeds the whole gang</div>
                <h2 className="disp">Deals</h2>
              </div>
              <p>Bundles built for families, hostels and late-night cravings. Same kitchen, better price.</p>
            </div>
            <div className="deals">
              {deals.slice(0, 4).map((d, i) => (
                <DealCard key={d.id} item={d} big={i === 0} onOpen={setOpen} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------- featured ---------------------------- */}
      {featured.length > 0 && (
        <section className="sec alt">
          <div className="wrap">
            <div className="sec-h">
              <div>
                <div className="eb">What everyone orders</div>
                <h2 className="disp">The favourites</h2>
              </div>
              <Link to="/menu" className="btn o sm">Full menu <Icon name="arrow" size={14} /></Link>
            </div>
            <div className="items">
              {featured.map((item) => (
                <ItemCard key={item.id} item={item} onOpen={setOpen} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------- categories --------------------------- */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-h">
            <div>
              <div className="eb">Four kitchens, one roof</div>
              <h2 className="disp">Browse by counter</h2>
            </div>
            <p>Desi karahi for Abbu, pizza for the kids, a zinger for you — all from the same kitchen.</p>
          </div>
          <div className="cat-tiles">
            {categories.filter((c) => c.id !== 'deals').map((c) => (
              <Link key={c.id} to={`/menu?cat=${c.id}`} className="cat-tile">
                <span className="ct-name">{c.name}</span>
                <span className="ct-ur ur">{c.ur}</span>
                <span className="ct-count">{counts.get(c.id) || 0} items</span>
                <span className="ct-arrow"><Icon name="arrow" size={16} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- how it works -------------------------- */}
      <section className="sec dark">
        <div className="wrap">
          <div className="sec-h">
            <div>
              <div className="eb">From screen to doorstep</div>
              <h2 className="disp">How it works</h2>
            </div>
          </div>
          <ol className="steps3">
            <li>
              <span className="n">01</span>
              <b>Pick your food</b>
              <p>Browse the live menu. Sold-out dishes disappear the moment the kitchen runs out.</p>
            </li>
            <li>
              <span className="n">02</span>
              <b>We cook it fresh</b>
              <p>Charcoal lit every evening. Your order goes straight to the kitchen screen.</p>
            </li>
            <li>
              <span className="n">03</span>
              <b>Track it live</b>
              <p>Watch the status change in real time — from the grill to your gate.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* ------------------------------ story ------------------------------ */}
      <section className="story">
        <video src="/assets/hero-smoke.mp4" autoPlay muted loop playsInline />
        <div className="wrap">
          <div className="story-copy">
            <div className="eb on-dark">The rising food point of Taunsa</div>
            <h2 className="disp">Four kitchens.<br /><em>One joy.</em></h2>
            <p>
              Foodeez started with one idea: Taunsa deserves a place where the whole family finds
              their favourite on the same table. Desi karahi for Abbu, pizza for the kids, a zinger
              for you — all hot, all fresh, all from one kitchen on New College Road.
            </p>
            <Link to="/about" className="btn y">Read our story <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="pillars">
            <div><b>Charcoal</b><span>BBQ grilled on real coal every evening — that smoke is the flavour.</span></div>
            <div><b>Fresh daily</b><span>Chicken bought every morning. Marinades made in-house, never bottled.</span></div>
            <div><b>Family seating</b><span>Separate family hall, clean washrooms, space for big groups.</span></div>
            <div><b>Our own riders</b><span>Delivery across Taunsa city. Hot food, no aggregator markup.</span></div>
          </div>
        </div>
      </section>

      {/* ----------------------------- reviews ----------------------------- */}
      {reviews.length > 0 && (
        <section className="sec">
          <div className="wrap">
            <div className="sec-h">
              <div>
                <div className="eb">Straight from the table</div>
                <h2 className="disp">What Taunsa says</h2>
              </div>
              <div className="rating-summary">
                <b>{summary.average.toFixed(1)}</b>
                <div>
                  <Stars value={summary.average} size={14} />
                  <small>{summary.count} review{summary.count === 1 ? '' : 's'}</small>
                </div>
              </div>
            </div>
            <div className="reviews">
              {reviews.slice(0, 3).map((r) => <ReviewCard key={r.id} review={r} />)}
            </div>
            <div className="center-row">
              <Link to="/reviews" className="btn o sm">Read all reviews <Icon name="arrow" size={14} /></Link>
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------- reserve ----------------------------- */}
      <section className="sec reserve-band">
        <div className="wrap">
          <div className="rb-inner">
            <div>
              <div className="eb">Dine in with us</div>
              <h2 className="disp">Book a table</h2>
              <p>
                Birthdays, family dinners, team iftars — tell us when and how many, and the family
                hall will be ready. Tables confirm by phone within the hour.
              </p>
            </div>
            <div className="rb-actions">
              <Link to="/reserve" className="btn k">Reserve a table <Icon name="arrow" size={16} /></Link>
              <a className="btn o" href={`tel:${(s.phone2 || '').replace(/\s/g, '')}`}>
                <Icon name="phone" size={15} /> {s.phone2}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ visit ------------------------------ */}
      <section className="sec" id="visit">
        <div className="wrap">
          <div className="sec-h">
            <div>
              <div className="eb">Find us</div>
              <h2 className="disp">Visit Foodeez</h2>
            </div>
          </div>
          <div className="visit-grid">
            <div className="panel">
              <dl className="kv">
                <dt>Address</dt><dd>{s.address}</dd>
                <dt>Hours</dt><dd>Every day · {s.hours}</dd>
                <dt>Delivery</dt><dd><a href={`tel:${(s.phone1 || '').replace(/\s/g, '')}`}>{s.phone1}</a></dd>
                <dt>Bookings</dt><dd><a href={`tel:${(s.phone2 || '').replace(/\s/g, '')}`}>{s.phone2}</a></dd>
                <dt>Delivery area</dt><dd>Within {s.radiusKm || 6} km of New College Road</dd>
              </dl>
              <div className="map">
                <div className="road" style={{ left: 0, right: 0, top: '58%', height: 18 }} />
                <div className="road" style={{ top: 0, bottom: 0, left: '30%', width: 14 }} />
                <div className="road" style={{ top: 0, bottom: 0, left: '78%', width: 10 }} />
                <span className="lbl" style={{ left: 12, top: 'calc(58% + 24px)' }}>New College Road</span>
                <span className="lbl" style={{ left: 'calc(30% + 20px)', top: 12 }}>Govt Degree College →</span>
                <div className="pin"><img src="/assets/logo.png" alt="" /></div>
              </div>
            </div>
            <div className="panel yellow">
              <h3 className="disp">Order in, or come over</h3>
              <p>Delivery across Taunsa city in about {s.eta || 35} minutes. Free over {rs(s.freeDeliveryOver || 2500)}.</p>
              <ul className="ticks">
                <li><Icon name="check" size={14} stroke={3} /> Cash on delivery, JazzCash and easypaisa</li>
                <li><Icon name="check" size={14} stroke={3} /> Separate family hall</li>
                <li><Icon name="check" size={14} stroke={3} /> Takeaway in ~20 minutes</li>
                <li><Icon name="check" size={14} stroke={3} /> Live order tracking</li>
              </ul>
              <div className="panel-actions">
                <Link to="/menu" className="btn k">Start an order</Link>
                <Link to="/contact" className="btn o">Contact us</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ItemModal item={open} onClose={() => setOpen(null)} />
    </>
  )
}

function Marquee() {
  const words = ['Zinger', 'Broast', 'Karahi', 'Tikka Boti', 'Reshmi Kabab', 'Pizza', 'Fried Rice', 'Manchurian', 'BBQ Paratha', 'Shakes']
  const row = [...words, ...words]
  return (
    <div className="marq" aria-hidden="true">
      <div className="track">{row.map((w, i) => <span key={i}>{w}</span>)}</div>
    </div>
  )
}
