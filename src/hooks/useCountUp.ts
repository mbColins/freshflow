import { useEffect, useRef, useState } from 'react'

// With Reduce motion on (the app's setting or the system's), figures just show
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'

// Counts up to `target`, easing out, after `delay` ms: from 0 the first time, and from
// the figure on screen when `target` changes. Returns the figure to show right now
function useCountUp(target: number, { delay = 0, duration = 1400 }: { delay?: number; duration?: number } = {}) {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))
  // The figure last put on screen, where a new animation picks up from
  const shown = useRef(value)

  useEffect(() => {
    if (reducedMotion()) return
    let frame = 0
    const timer = window.setTimeout(() => {
      const from = shown.current
      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        shown.current = from + (target - from) * (1 - Math.pow(1 - progress, 3))
        setValue(shown.current)
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, delay)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [target, delay, duration])

  // Checked on every render, so turning Reduce motion on mid-session stops the counting
  return reducedMotion() ? target : value
}

export default useCountUp
