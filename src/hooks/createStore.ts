import { useSyncExternalStore } from 'react'

// A value shared across components, read with a hook and replaced with set().
// Backs the in-memory stores (branches, customers, settings…).
export function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()

  const get = () => value
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    get,
    set(next: T) {
      value = next
      listeners.forEach((listener) => listener())
    },
    // Re-renders the component whenever the value is replaced
    useValue: () => useSyncExternalStore(subscribe, get),
  }
}
