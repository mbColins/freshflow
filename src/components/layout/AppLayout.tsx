import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import useSettings from '../../hooks/useSettings'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

function AppLayout() {
  const settings = useSettings()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(settings.sidebarCollapsed)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Auto-lock: back to sign-in after a stretch with no mouse or keyboard activity
  useEffect(() => {
    if (settings.autoLockMinutes <= 0) return
    let timer = 0
    const restart = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => navigate('/login'), settings.autoLockMinutes * 60_000)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const
    events.forEach((name) => window.addEventListener(name, restart, { passive: true }))
    restart()
    return () => {
      window.clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, restart))
    }
  }, [settings.autoLockMinutes, navigate])

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
