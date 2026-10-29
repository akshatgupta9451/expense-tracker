import { useCallback, useEffect, useMemo, useState } from 'react'
import { setSessionExpiredHandler } from '@/services/apiClient'
import { authService } from '@/services/authService'
import { userService } from '@/services/userService'
import { tokenStore } from '@/services/tokenStore'
import { AuthContext } from './AuthContext'

/**
 * status:
 *   "loading"         – checking for an existing session on first load
 *   "authenticated"   – user is logged in
 *   "unauthenticated" – no session
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const clearSession = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  // On first load, try to restore the session from the refresh cookie.
  useEffect(() => {
    let cancelled = false
    authService
      .restoreSession()
      .then(() => userService.getMe())
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => !cancelled && clearSession())
    return () => {
      cancelled = true
    }
  }, [clearSession])

  // If a refresh fails mid-session (expired/revoked), drop back to logged-out.
  useEffect(() => {
    setSessionExpiredHandler(clearSession)
    return () => setSessionExpiredHandler(() => {})
  }, [clearSession])

  const login = useCallback(async (credentials) => {
    await authService.login(credentials)
    const me = await userService.getMe()
    setUser(me)
    setStatus('authenticated')
    return me
  }, [])

  const register = useCallback(
    async ({ name, email, password }) => {
      await authService.register({ name, email, password })
      return login({ email, password })
    },
    [login],
  )

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
      setUser, // for profile updates
    }),
    [user, status, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
