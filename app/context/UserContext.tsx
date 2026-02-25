'use client'

import { createContext, useContext, useState, useEffect, useRef } from 'react'
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
}

const UserContext = createContext<UserContextValue>({
  dbUser: null,
  setDbUser: () => {},
  isUserLoading: true,
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser()
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [isUserLoading, setIsUserLoading] = useState(true)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (isSignedIn === undefined) return

    if (isSignedIn === false) {
      hasFetched.current = false
      setDbUser(null)
      setIsUserLoading(false)
      return
    }

    if (isSignedIn === true && !hasFetched.current) {
      hasFetched.current = true
      setIsUserLoading(true)
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.user) setDbUser(data.user)
        })
        .catch(() => {})
        .finally(() => setIsUserLoading(false))
    }
  }, [isSignedIn])

  return (
    <UserContext.Provider value={{ dbUser, setDbUser, isUserLoading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useDbUser() {
  return useContext(UserContext)
}
