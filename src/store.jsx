import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './lib/api.js'
import { unitPrice, optionLabel } from './lib/utils.js'

const Ctx = createContext(null)
const CART_KEY = 'fz_cart_v2'
const TRACK_KEY = 'fz_track_v1'

/* ------------------------------- storage -------------------------------- */

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((l) => l && l.itemId && l.qty > 0) : []
  } catch { return [] }
}

function loadTickets() {
  try { return JSON.parse(localStorage.getItem(TRACK_KEY) || '{}') } catch { return {} }
}

export function AppProvider({ children }) {
  const [boot, setBoot] = useState(null)
  const [bootError, setBootError] = useState(null)
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [cart, setCart] = useState(loadCart)
  const [tickets, setTickets] = useState(loadTickets)
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  /* ---- bootstrap catalogue ---- */
  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/bootstrap')
      setBoot(data)
      setBootError(null)
      return data
    } catch (e) {
      setBootError(e.message)
      return null
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  /* ---- session ---- */
  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api.get('/auth/me')
      setUser(user)
      return user
    } catch {
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => { refreshUser() }, [refreshUser])

  /* ---- cart persistence ---- */
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem(TRACK_KEY, JSON.stringify(tickets)) }, [tickets])

  /* ---- toasts ---- */
  const toast = useCallback((message, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, tone }])
    const timer = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
      timers.current.delete(id)
    }, 3200)
    timers.current.set(id, timer)
  }, [])

  useEffect(() => () => { for (const t of timers.current.values()) clearTimeout(t) }, [])

  /* ---- menu lookup ---- */
  const menuById = useMemo(() => {
    const m = new Map()
    for (const item of boot?.menu || []) m.set(item.id, item)
    return m
  }, [boot])

  /* ---- cart ops ---- */
  const addToCart = useCallback((item, choices = [], qty = 1, note = '') => {
    const key = `${item.id}|${[...choices].sort((a, b) => a - b).join(',')}|${note}`
    setCart((prev) => {
      const i = prev.findIndex((l) => l.key === key)
      if (i >= 0) {
        const next = [...prev]
        next[i] = { ...next[i], qty: Math.min(20, next[i].qty + qty) }
        return next
      }
      return [...prev, {
        key, itemId: item.id, qty, choices, note,
        name: item.name, img: item.img,
        unit: unitPrice(item, choices),
        opts: optionLabel(item, choices),
      }]
    })
    toast(`${qty}× ${item.name} added`)
  }, [toast])

  const setQty = useCallback((key, qty) => {
    setCart((prev) => (qty <= 0
      ? prev.filter((l) => l.key !== key)
      : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, qty) } : l))))
  }, [])

  const removeLine = useCallback((key) => setCart((prev) => prev.filter((l) => l.key !== key)), [])
  const clearCart = useCallback(() => setCart([]), [])

  const cartCount = cart.reduce((n, l) => n + l.qty, 0)
  const cartSubtotal = cart.reduce((n, l) => n + l.unit * l.qty, 0)

  /* ---- order tickets (for tracking links) ---- */
  const rememberTicket = useCallback((orderId, token) => {
    setTickets((t) => ({ ...t, [orderId]: token }))
  }, [])

  /* ---- auth ---- */
  const loginCustomer = useCallback(async (phone, password) => {
    const { user } = await api.post('/auth/login', { phone, password })
    setUser(user)
    return user
  }, [])

  const registerCustomer = useCallback(async (payload) => {
    const { user } = await api.post('/auth/register', payload)
    setUser(user)
    return user
  }, [])

  const loginStaff = useCallback(async (email, password) => {
    const { user } = await api.post('/auth/staff/login', { email, password })
    setUser(user)
    return user
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch { /* already gone */ }
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    boot, bootError, refresh, settings: boot?.settings || {},
    menu: boot?.menu || [], menuById, categories: boot?.categories || [],
    user, refreshUser, loginCustomer, registerCustomer, loginStaff, logout,
    cart, cartCount, cartSubtotal, addToCart, setQty, removeLine, clearCart,
    tickets, rememberTicket,
    toasts, toast, dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
  }), [boot, bootError, refresh, menuById, user, refreshUser, loginCustomer,
    registerCustomer, loginStaff, logout, cart, cartCount, cartSubtotal,
    addToCart, setQty, removeLine, clearCart, tickets, rememberTicket, toasts, toast])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
