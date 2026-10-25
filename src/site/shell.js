import { createContext, useContext } from 'react'

/** Shell-level UI actions (cart drawer) shared across pages. */
export const ShellCtx = createContext({ openCart: () => {}, closeCart: () => {} })

export const useShell = () => useContext(ShellCtx)
