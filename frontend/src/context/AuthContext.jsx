import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchMe, loginUser } from '../api/auth'
import { setUnauthorizedHandler, TOKEN_KEY } from '../api/client'
import { AuthContext } from './auth'

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Có token sẵn → chờ GET /auth/me khôi phục phiên trước khi quyết định chuyển hướng
  const [loading, setLoading] = useState(() => Boolean(readToken()))

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    if (!readToken()) return
    fetchMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (credentials) => {
    const { token, user: loggedIn } = await loginUser(credentials)
    localStorage.setItem(TOKEN_KEY, token)
    setUser(loggedIn)
    return loggedIn
  }, [])

  // BR-06: JWT stateless → đăng xuất chỉ xóa token phía client
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
