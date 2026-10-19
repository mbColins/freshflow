import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../constants/settings'
import type { AppSettings } from '../types/settings'
import { createStore } from './createStore'

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

const store = createStore<AppSettings>(load())

// For code outside React, such as date formatters
export const getSettings = store.get

export const settingsStore = {
  save(next: AppSettings) {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage can be blocked (private mode); the settings still apply until reload
    }
    store.set(next)
  },
}

const useSettings = store.useValue

export default useSettings
