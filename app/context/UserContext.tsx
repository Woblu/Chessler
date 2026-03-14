'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'

export interface DbUser {
  id: string
  clerk_id: string
  name: string
  email: string
  totalGames: number
  pieceSet: string
  boardStyle: string
  pawns: number
  xp: number
  rating: number
  ratingDeviation: number
  volatility: number
}

interface UserContextValue {
  dbUser: DbUser | null
  setDbUser: (user: DbUser | null) => void
  isUserLoading: boolean
  /** True when Clerk is signed in but /api/auth/me failed (so we can show retry UI instead of landing). */
  loadError: boolean
  /** Retry loading app user from /api/auth/me. */
  refetchUser: () => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  dbUser: null,
  setDbUser: () => {},
  isUserLoading: true,
  loadError: false,
  refetchUser: async () => {},
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser()
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [isUserLoading, setIsUserLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const hasFetched = useRef(false)

  const fetchMe = useCallback(async () => {
    setLoadError(false)
    const r = await fetch('/api/auth/me')
    const data = r.ok ? await r.json() : null
    if (data?.user) {
      setDbUser(data.user)
      setLoadError(false)
    } else {
      setDbUser(null)
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    if (isSignedIn === undefined) return

    if (isSignedIn === false) {
      hasFetched.current = false
      setDbUser(null)
      setLoadError(false)
      setIsUserLoading(false)
      return
    }

    if (isSignedIn === true && !hasFetched.current) {
      hasFetched.current = true
      setIsUserLoading(true)
      setLoadError(false)
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.user) {
            setDbUser(data.user)
            setLoadError(false)
          } else {
            setDbUser(null)
            setLoadError(true)
          }
        })
        .catch(() => {
          setDbUser(null)
          setLoadError(true)
        })
        .finally(() => setIsUserLoading(false))
    }
  }, [isSignedIn])

  const refetchUser = useCallback(async () => {
    if (!isSignedIn) return
    setIsUserLoading(true)
    await fetchMe()
    setIsUserLoading(false)
  }, [isSignedIn, fetchMe])

  return (
    <UserContext.Provider value={{ dbUser, setDbUser, isUserLoading, loadError, refetchUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useDbUser() {
  return useContext(UserContext)
}
