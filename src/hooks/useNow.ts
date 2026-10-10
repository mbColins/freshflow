import { useEffect, useState } from 'react'

// Current time that re-renders on an interval, for "due in 2h" style labels
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}

export default useNow
