import { useState, useCallback } from 'react'

export function useAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async (password: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include',
      })
      if (res.ok) return true
      const data = await res.json()
      setError(data.error ?? 'Login failed')
      return false
    } catch {
      setError('Network error')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }, [])

  return { login, logout, loading, error }
}
