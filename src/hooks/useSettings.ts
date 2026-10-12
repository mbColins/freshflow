import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../constants/settings'
import type { AppSettings } from '../types/settings'

// Application preferences for this browser, kept in localStorage.
// TODO: sync with the user's profile once the settings API exists.
function load(): AppSettings {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    // Defaults fill in any setting added since the preferences were saved
    return stored
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<AppSettings>) }
      : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

let settings = load()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// For code outside React, such as date formatters
export function getSettings() {
  return settings
}

export const settingsStore = {
  save(next: AppSettings) {
    settings = next
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage can be blocked (private mode); the settings still apply until reload
    }
    listeners.forEach((listener) => listener())
  },
}

function useSettings() {
  return useSyncExternalStore(subscribe, getSettings)
}

export default useSettings
