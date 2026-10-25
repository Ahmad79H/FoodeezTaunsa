/** Shared UI atoms — icons, stars, fields, modal, toasts. */

import { Component, useEffect, useRef } from 'react'
import { cn } from './lib/utils.js'

/* --------------------------------- icons -------------------------------- */

const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" />,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  back: <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  check: <path d="M4 12l5 5L20 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M12 22s7-6.2 7-12A7 7 0 005 10c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  truck: <><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M2.5 20c0-3.4 3-5.4 6.5-5.4S15.5 16.6 15.5 20" /><path d="M16 5.5a3.2 3.2 0 010 5.6M18 14.6c2.2.6 3.6 2.3 3.6 5.4" /></>,
  trash: <><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></>,
  edit: <><path d="M4 20h4l10-10-4-4L4 16v4z" /><path d="M14 6l4 4" /></>,
  logout: <><path d="M9 5H5v14h4" /><path d="M16 8l4 4-4 4M20 12H10" /></>,
  chart: <><path d="M4 20V9M10 20V4M16 20v-7M22 20H2" /></>,
  box: <><path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M3 8v8l9 4 9-4V8" /><path d="M12 12v8" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  tag: <><path d="M20 12l-8 8-9-9V3h8l9 9z" /><circle cx="7.5" cy="7.5" r="1.4" /></>,
  bike: <><circle cx="6" cy="17" r="3.2" /><circle cx="18" cy="17" r="3.2" /><path d="M9 17h4l3-7 2 7M13 10l-2-4h3" /></>,
  message: <path d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 018-8h2a8 8 0 018 8z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>,
  star: <path d="M12 3l2.7 5.8 6.3.8-4.6 4.3 1.2 6.2L12 17.2 6.4 20.1l1.2-6.2L3 9.6l6.3-.8L12 3z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></>,
  fire: <path d="M12 22c4 0 7-2.7 7-6.4 0-4.6-4.6-6-4.3-11.6-3 1.2-5.2 4.2-5.2 6.8 0 1.3.5 2.3 1.2 3-1.6-.3-2.9-1.8-3.1-3.6C6 12 5 13.8 5 15.6 5 19.3 8 22 12 22z" />,
  leaf: <><path d="M20 4c-9 0-15 4-15 10a6 6 0 006 6c6 0 9-6 9-16z" /><path d="M5 20c3-6 8-9 12-11" /></>,
  alert: <><path d="M12 4l9 16H3l9-16z" /><path d="M12 10v4M12 17v.5" /></>,
  eye: <><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.6" /></>,
  wifi: <><path d="M4 9a12 12 0 0116 0M7 12.5a8 8 0 0110 0M10 16a3.6 3.6 0 014 0" /><circle cx="12" cy="19" r="1" /></>,
}

export function Icon({ name, size = 18, stroke = 2.2, className }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      {PATHS[name] || null}
    </svg>
  )
}

/* -------------------------------- stars --------------------------------- */

export function Stars({ value = 0, size = 15, className }) {
  return (
    <span className={cn('stars', className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i <= Math.round(value) ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l2.7 5.8 6.3.8-4.6 4.3 1.2 6.2L12 17.2 6.4 20.1l1.2-6.2L3 9.6l6.3-.8L12 3z" />
        </svg>
      ))}
    </span>
  )
}

export function StarPicker({ value, onChange }) {
  return (
    <span className="star-picker">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)}
          className={i <= value ? 'on' : ''} aria-label={`${i} star${i > 1 ? 's' : ''}`}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill={i <= value ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M12 3l2.7 5.8 6.3.8-4.6 4.3 1.2 6.2L12 17.2 6.4 20.1l1.2-6.2L3 9.6l6.3-.8L12 3z" />
          </svg>
        </button>
      ))}
    </span>
  )
}

/* -------------------------------- fields -------------------------------- */

export function Field({ label, error, hint, children, className }) {
  return (
    <label className={cn('field', error && 'err', className)}>
      {label && <span className="flabel">{label}</span>}
      {children}
      {error ? <span className="e">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  )
}

/* -------------------------------- modal --------------------------------- */

export function Modal({ open, onClose, children, className, labelledBy }) {
  const ref = useRef(null)

  // Callers pass an inline arrow, so this identity changes on every render.
  // Keeping it in a ref lets the effect below depend on `open` alone —
  // otherwise every keystroke re-ran it, re-focused the dialog and stole the
  // cursor out of whatever input the user was typing into.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // move focus into the dialog once, not on every render
    ref.current?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={cn('modal', className)} role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref} tabIndex={-1}>
        {children}
      </div>
    </>
  )
}

/* -------------------------------- misc ---------------------------------- */

export function Spinner({ label }) {
  return <div className="spinner-wrap"><span className="spinner" />{label && <span className="spinner-label">{label}</span>}</div>
}

export function Empty({ icon = 'box', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={34} stroke={1.6} />
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Badge({ children, tone = 'ink' }) {
  return <span className={cn('badge', `b-${tone}`)}>{children}</span>
}

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" className={cn('switch', checked && 'on')} role="switch"
      aria-checked={!!checked} aria-label={label} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

/** Scroll lock helper used by drawers. */
export function useBodyLock(locked) {
  useEffect(() => {
    const prev = document.body.style.overflow
    if (locked) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [locked])
}

/* ----------------------------- error boundary --------------------------- */

/**
 * Last line of defence. Without this, one thrown render takes the whole app
 * down to a white screen — which is exactly what a bad option list did once.
 * The customer gets a readable message and a way back instead.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ui] render failed', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <img src="/assets/logo.png" alt="" />
        <h2 className="disp">Something went wrong</h2>
        <p>Sorry — that page hit a snag. Your bag is safe.</p>
        <div className="btn-row center">
          <button className="btn y" onClick={() => { this.setState({ error: null }); window.location.reload() }}>
            Reload the page
          </button>
          <a className="btn o" href="/">Back to the menu</a>
        </div>
        <small className="muted">{String(this.state.error?.message || this.state.error)}</small>
      </div>
    )
  }
}
