import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const [password, setPassword] = useState('')
  const { login, loading, error } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = await login(password)
    if (ok) navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🏢</div>
          <h1 className="text-2xl font-bold tracking-tight">MyOffice HQ</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Your command center</p>
        </div>

        <form onSubmit={handleSubmit} className="surface rounded-xl p-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              autoComplete="current-password"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500
                         placeholder:text-[var(--muted)]"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
