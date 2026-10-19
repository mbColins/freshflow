import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import useSettings from '../../hooks/useSettings'
import { useLogoutMutation } from '../../services/authApi'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

function AppLayout() {
  const settings = useSettings()
  const [logout] = useLogoutMutation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(settings.sidebarCollapsed)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Auto-lock: end the session after a stretch with no mouse or keyboard
  // activity. RequireAuth then shows sign-in and returns here afterwards.
  useEffect(() => {
    if (settings.autoLockMinutes <= 0) return
    let timer = 0
    const restart = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => logout(), settings.autoLockMinutes * 60_000)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const
    events.forEach((name) => window.addEventListener(name, restart, { passive: true }))
    restart()
    return () => {
      window.clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, restart))
    }
  }, [settings.autoLockMinutes, logout])

  return (
    <div className="flex min-h-svh bg-canvas text-ink antialiased">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 space-y-4 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
