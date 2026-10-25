/** Minimal history router — no dependency, supports :params and a basename. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const RouterContext = createContext(null)

export function RouterProvider({ children, basename = '' }) {
  const [loc, setLoc] = useState(() => currentLocation(basename))

  useEffect(() => {
    const onPop = () => setLoc(currentLocation(basename))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [basename])

  const navigate = useCallback((to, { replace = false, scroll = true } = {}) => {
    const url = basename + (to.startsWith('/') ? to : '/' + to)
    if (url === window.location.pathname + window.location.search) return
    if (replace) window.history.replaceState({}, '', url)
    else window.history.pushState({}, '', url)
    setLoc(currentLocation(basename))
    if (scroll) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
  }, [basename])

  const value = useMemo(() => ({ ...loc, navigate }), [loc, navigate])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

function currentLocation(basename) {
  let path = window.location.pathname
  if (basename && path.startsWith(basename)) path = path.slice(basename.length) || '/'
  return { path: path || '/', search: window.location.search, hash: window.location.hash }
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>')
  return ctx
}

/** '/track/:id' + '/track/FZ-12' -> { id: 'FZ-12' } */
export function matchPath(pattern, path) {
  const p = pattern.split('/').filter(Boolean)
  const s = path.split('/').filter(Boolean)
  if (p.length !== s.length) return null
  const params = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i])
    else if (p[i] !== s[i]) return null
  }
  return params
}

export function Link({ to, children, className, onClick, ...rest }) {
  const { navigate } = useRouter()
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        onClick?.(e)
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
