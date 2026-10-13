import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, UNAUTHORIZED_EVENT, authApi, decodeUser, getToken, setToken } from '../lib/api'
import type { AuthUser } from '../types'

interface AuthState {
  user: AuthUser | null
  ready: boolean
  isAdmin: boolean
  /** Resolves with the session the server issued, so callers can inspect its role. */
  signIn: (email: string, password: string) => Promise<AuthUser>
  signOut: () => void
  /** Called when any request comes back 401 so the session can be cleared. */
  invalidate: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // The stored JWT is read synchronously, so the first paint already
  // knows whether there is a session — no loading flash on refresh.
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = getToken()
    return token ? decodeUser(token) : null
  })

  // Any 401 from the API layer means the token is gone or expired. Reading a
  // storage value is an external sync, so the effect is the right home for it.
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null)
      setUser(null)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const next = await authApi.login(email, password)
    setUser(next)
    return next
  }, [])

  const signOut = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const invalidate = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready: true,
      isAdmin: user?.role === 'admin',
      signIn,
      signOut,
      invalidate,
    }),
    [user, signIn, signOut, invalidate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** Converts a thrown API error into a message safe to show a user. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
