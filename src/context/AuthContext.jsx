import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On load, if we have a token, verify it and fetch the current user.
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const { user } = await api.get('/auth/me')
        if (active) setUser(user)
      } catch {
        setToken('') // invalid/expired
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const signUp = async ({ fullName, password, role }) => {
    try {
      const { token, user } = await api.post('/auth/signup', { fullName, password, role })
      setToken(token)
      setUser(user)
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  const signIn = async ({ fullName, password }) => {
    try {
      const { token, user } = await api.post('/auth/login', { fullName, password })
      setToken(token)
      setUser(user)
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  const signOut = () => {
    setToken('')
    setUser(null)
  }

  const value = {
    user,
    profile: user, // pages read profile.full_name — user has it
    role: user?.role ?? null,
    isTeacher: user?.role === 'teacher',
    loading,
    isConfigured: true, // config is server-side now
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
