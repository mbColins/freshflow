import type {
  AppSettings,
  DateFormat,
  Language,
  TextScale,
  ThemeMode,
  TimeFormat,
} from '../types/settings'

export const SETTINGS_STORAGE_KEY = 'app.settings'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accent: 'blue',
  textScale: 100,
  reduceMotion: false,
  language: 'en',
  dateFormat: 'medium',
  timeFormat: '24h',
  showNavBadges: true,
  sidebarCollapsed: false,
  startPage: '/',
  autoLockMinutes: 30,
}

export const THEMES: { value: ThemeMode; label: string; help: string }[] = [
  { value: 'light', label: 'Light', help: 'Bright and high contrast for daylight counters.' },
  { value: 'dark', label: 'Dark', help: 'Easier on the eyes for evening shifts and back rooms.' },
  { value: 'system', label: 'System', help: 'Follows this device’s light or dark setting.' },
]

// Every accent keeps white button text readable
export const ACCENTS: { id: string; label: string; color: string; dark: string }[] = [
  { id: 'blue', label: 'Blue', color: '#2563eb', dark: '#1d4ed8' },
  { id: 'teal', label: 'Teal', color: '#0f766e', dark: '#115e59' },
  { id: 'green', label: 'Green', color: '#15803d', dark: '#166534' },
  { id: 'violet', label: 'Violet', color: '#6d28d9', dark: '#5b21b6' },
  { id: 'slate', label: 'Slate', color: '#475569', dark: '#334155' },
]

export const TEXT_SCALES: { value: TextScale; label: string }[] = [
  { value: 100, label: '100%' },
  { value: 110, label: '110%' },
  { value: 125, label: '125%' },
]

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
]

export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'medium', label: 'Oct 24, 2026' },
  { value: 'dmy', label: '24/10/2026' },
  { value: 'iso', label: '2026-10-24' },
]

export const TIME_FORMATS: { value: TimeFormat; label: string }[] = [
  { value: '24h', label: '24-hour (14:30)' },
  { value: '12h', label: '12-hour (2:30 PM)' },
]

export const START_PAGES: { value: string; label: string }[] = [
  { value: '/', label: 'Dashboard' },
  { value: '/orders', label: 'Orders' },
  { value: '/customers', label: 'Customers' },
  { value: '/pickup-delivery', label: 'Pickup & Delivery' },
  { value: '/payments', label: 'Payments' },
  { value: '/machines', label: 'Machines' },
]

export const AUTO_LOCK_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Never' },
  { value: 5, label: 'After 5 minutes' },
  { value: 15, label: 'After 15 minutes' },
  { value: 30, label: 'After 30 minutes' },
  { value: 60, label: 'After 1 hour' },
]

// Shown in the unsaved-changes bar
export const SETTING_LABELS: Record<keyof AppSettings, string> = {
  theme: 'Theme',
  accent: 'Accent color',
  textScale: 'Text size',
  reduceMotion: 'Reduce motion',
  language: 'Language',
  dateFormat: 'Date format',
  timeFormat: 'Time format',
  showNavBadges: 'Sidebar count badges',
  sidebarCollapsed: 'Sidebar start state',
  startPage: 'Start screen',
  autoLockMinutes: 'Auto-lock',
}
