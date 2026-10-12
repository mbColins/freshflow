export type ThemeMode = 'light' | 'dark' | 'system'
export type Language = 'en' | 'fr'
export type DateFormat = 'medium' | 'dmy' | 'iso'
export type TimeFormat = '24h' | '12h'
export type TextScale = 100 | 110 | 125

export type AppSettings = {
  theme: ThemeMode
  // One of the ACCENTS ids
  accent: string
  textScale: TextScale
  reduceMotion: boolean
  language: Language
  dateFormat: DateFormat
  timeFormat: TimeFormat
  showNavBadges: boolean
  sidebarCollapsed: boolean
  // Route opened after signing in
  startPage: string
  // 0 never locks
  autoLockMinutes: number
}
