import { useEffect, useState } from 'react'
import { Maximize, Minimize } from 'lucide-react'

// Switches the whole app between the browser window and full screen. Hidden
// where the browser doesn't allow it (some phones and embedded views)
function FullscreenToggle() {
  const [active, setActive] = useState(() => Boolean(document.fullscreenElement))

  // Also follows Esc and F11, which leave full screen without our button
  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  if (!document.fullscreenEnabled) return null

  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      // The browser refused (no user gesture, or a policy); nothing to show
    }
  }

  const label = active ? 'Exit full screen' : 'Enter full screen'
  const Icon = active ? Minimize : Maximize
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-label={label}
      title={label}
      className="hidden size-9 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none sm:flex"
    >
      <Icon className="size-4.5" aria-hidden="true" />
    </button>
  )
}

export default FullscreenToggle
