import { useEffect, useState } from 'react'
import { Link, matchPath, useRouter } from '../router.jsx'
import { useApp } from '../store.jsx'
import { Icon } from '../ui.jsx'
import { rs, cn } from '../lib/utils.js'
import CartDrawer from './CartDrawer.jsx'
import { ShellCtx } from './shell.js'

import Home from './Home.jsx'
import MenuPage from './MenuPage.jsx'
import Checkout from './Checkout.jsx'
import Track from './Track.jsx'
import { About, Contact, Reviews, Reserve, FAQ, NotFound } from './Pages.jsx'
import { Account, Auth } from './Account.jsx'

const NAV = [
  { to: '/menu', label: 'Menu' },
  { to: '/menu?cat=deals', label: 'Deals' },
  { to: '/about', label: 'Our story' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/reserve', label: 'Book a table' },
  { to: '/contact', label: 'Contact' },
]

export default function SiteApp() {
  const { settings, cartCount, cartSubtotal, user, toasts, dismissToast } = useApp()
  const { path, search } = useRouter()
  const [cartOpen, setCartOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setNavOpen(false) }, [path, search])

  const s = settings || {}
  const open = s.open !== false && s.acceptingOrders !== false
  const announcement = (s.announcements || []).find((a) => a.active)

  return (
    <ShellCtx.Provider value={{ openCart: () => setCartOpen(true), closeCart: () => setCartOpen(false) }}>
      <div className={cn('site', announcement && 'has-ann')}>
        <nav className={cn('nav', (solid || path !== '/') && 'solid')}>
          {announcement && <div className="annbar">{announcement.text}</div>}
          <div className="wrap">
            <Link to="/" className="brand">
              <img src="/assets/logo.png" alt="" />
              <b>FOODEEZ</b>
            </Link>

            <div className={cn('links', navOpen && 'open')}>
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} className={cn('navlink', isActive(path, search, n.to) && 'on')}>
                  {n.label}
                </Link>
              ))}
            </div>

            <div className="sp" />

            <a className="call" href={`tel:${(s.phone1 || '').replace(/\s/g, '')}`}>
              <span className={cn('status-dot', !open && 'closed')} />
              <span className="call-text">{open ? 'Open now' : 'Closed'} · {s.phone1}</span>
            </a>

            <Link to={user ? '/account' : '/login'} className="iconbtn" aria-label="Account">
              <Icon name="user" size={19} />
              {user?.role === 'customer' && user.name && <span className="who">{user.name.split(' ')[0]}</span>}
            </Link>

            <button className="btn y cartbtn" onClick={() => setCartOpen(true)}>
              <Icon name="bag" size={17} />
              <span className="cart-text">Bag</span>
              {cartCount > 0 && <span className="count">{cartCount}</span>}
            </button>

            <button className="hamburger" onClick={() => setNavOpen((v) => !v)} aria-label="Menu" aria-expanded={navOpen}>
              <span /><span /><span />
            </button>
          </div>
        </nav>

        <main>
          <Route path={path} search={search} />
        </main>

        <Footer />

        {cartCount > 0 && (
          <button className="mcart" onClick={() => setCartOpen(true)}>
            <span>{cartCount} item{cartCount > 1 ? 's' : ''} · View bag</span>
            <span>{rs(cartSubtotal)}</span>
          </button>
        )}

        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

        <div className="toasts">
          {toasts.map((t) => (
            <button key={t.id} className={cn('toast', t.tone)} onClick={() => dismissToast(t.id)}>
              <i><Icon name={t.tone === 'err' ? 'alert' : 'check'} size={14} stroke={3} /></i>
              {t.message}
            </button>
          ))}
        </div>
      </div>
    </ShellCtx.Provider>
  )
}

function isActive(path, search, to) {
  const [p, q] = to.split('?')
  if (p !== path) return false
  if (!q) return true
  const want = new URLSearchParams(q).get('cat')
  const have = new URLSearchParams(search).get('cat')
  return want === have
}

function Route({ path, search }) {
  if (path === '/') return <Home />
  if (path === '/menu') return <MenuPage search={search} />
  if (path === '/about') return <About />
  if (path === '/reviews') return <Reviews />
  if (path === '/reserve') return <Reserve />
  if (path === '/contact') return <><Contact /><FAQ /></>
  if (path === '/checkout') return <Checkout />
  if (path === '/login') return <Auth mode="login" search={search} />
  if (path === '/register') return <Auth mode="register" search={search} />
  if (path === '/account') return <Account />
  const track = matchPath('/track/:id', path)
  if (track) return <Track id={track.id} search={search} />
  return <NotFound />
}

function Footer() {
  const { settings: s = {} } = useApp()
  return (
    <footer className="ft">
      <div className="wrap">
        <div className="ft-top">
          <div className="ft-brand">
            <div className="big disp">Foodeez</div>
            <p>{s.tagline || 'Taste the joy'} — Pakistani, Chinese, BBQ and fast food on {s.address || 'New College Road'}.</p>
            <div className="ft-social">
              <a href="https://www.facebook.com/people/Foodeez/100066919813037/" target="_blank" rel="noreferrer">Facebook</a>
              <a href="https://www.tiktok.com/@foodeeztaunsa1" target="_blank" rel="noreferrer">TikTok</a>
            </div>
          </div>

          <div className="ft-col">
            <h5>Order</h5>
            <Link to="/menu">Full menu</Link>
            <Link to="/menu?cat=deals">Deals</Link>
            <Link to="/reserve">Book a table</Link>
            <Link to="/account">My orders</Link>
          </div>

          <div className="ft-col">
            <h5>Visit</h5>
            <span>{s.address}</span>
            <a href={`tel:${(s.phone1 || '').replace(/\s/g, '')}`}>{s.phone1}</a>
            <a href={`tel:${(s.phone2 || '').replace(/\s/g, '')}`}>{s.phone2}</a>
            <span>Daily · {s.hours}</span>
          </div>

          <div className="ft-col">
            <h5>Company</h5>
            <Link to="/about">Our story</Link>
            <Link to="/reviews">Reviews</Link>
            <Link to="/contact">Contact</Link>
            <a href="/prd">Product brief</a>
            <a href="/admin">Staff login</a>
          </div>
        </div>

        <div className="legal">
          <span>© {new Date().getFullYear()} Foodeez · Taunsa Sharif</span>
          <span>Made fresh, made to order.</span>
        </div>
      </div>
    </footer>
  )
}
