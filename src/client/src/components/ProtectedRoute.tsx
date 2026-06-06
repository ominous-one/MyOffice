import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props { children: ReactNode }

export function ProtectedRoute({ children }: Props) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    fetch('/api/auth/sessions', { credentials: 'include' })
      .then((r) => {
        if (r.ok) { setAuthed(true) }
        else { navigate('/login', { replace: true }) }
      })
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setChecking(false))
  }, [navigate])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--muted)] text-sm">
        Loading…
      </div>
    )
  }

  return authed ? <>{children}</> : null
}
