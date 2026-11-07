import { useEffect, useState } from 'react'

// The value, but only once it has stopped changing for `delay` ms; keeps a search box
// from asking the server on every keystroke
export default function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}
