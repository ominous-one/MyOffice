import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Office } from './pages/Office'
import { Workstation } from './pages/Workstation'
import { DaemonStatus } from './components/DaemonStatus'
import { JarvisPanel } from './components/JarvisPanel'
import { OfficeTabBar } from './components/OfficeTabBar'
import { useAuth } from './hooks/useAuth'
import { Home, LogOut } from 'lucide-react'

function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()
  const inProject = location.pathname.startsWith('/project/')

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] flex-shrink-0 bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-semibold hover:text-brand-400 transition-colors"
          >
            🏢 <span className="hidden sm:inline">MyOffice HQ</span>
          </button>
          {inProject && (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              <Home size={12} /> Dashboard
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <DaemonStatus />
          <button
            onClick={logout}
            className="text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
      <OfficeTabBar />
      <JarvisPanel />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <Office />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/grid"
        element={
          <ProtectedRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:id"
        element={
          <ProtectedRoute>
            <AppShell>
              <Workstation />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
