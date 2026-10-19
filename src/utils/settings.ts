import { ACCENTS } from '../constants/settings'
import type { AppSettings, Language } from '../types/settings'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function prefersDark() {
  return window.matchMedia(DARK_QUERY).matches
}

// Calls back whenever the device switches between light and dark
export function watchSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

// Puts the appearance settings on <html>, where index.css picks them up
export function applySettings(settings: AppSettings) {
  const root = document.documentElement
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark())
  const accent = ACCENTS.find(({ id }) => id === settings.accent) ?? ACCENTS[0]
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full'
  root.style.setProperty('--color-brand', accent.color)
  root.style.setProperty('--color-brand-dark', accent.dark)
  root.style.setProperty('--text-scale', String(settings.textScale / 100))
  root.style.fontSize = `${settings.textScale}%`
  root.lang = settings.language
}

// Navigation labels; the rest of the interface is English only for now
const FRENCH: Record<string, string> = {
  Operations: 'Opérations',
  Management: 'Gestion',
  Platform: 'Plateforme',
  Tenants: 'Organisations',
  Dashboard: 'Tableau de bord',
  Orders: 'Commandes',
  Customers: 'Clients',
  Services: 'Services',
  'Laundry Operations': 'Opérations de blanchisserie',
  'Pickup & Delivery': 'Collecte et livraison',
  Payments: 'Paiements',
  Inventory: 'Stock',
  Staff: 'Personnel',
  Reports: 'Rapports',
  Notifications: 'Notifications',
  Branches: 'Agences',
  Machines: 'Machines',
  Pricing: 'Tarifs',
  'Price List': 'Grille tarifaire',
  'Subscription Plans': "Formules d'abonnement",
  Promotions: 'Promotions',
  Settings: 'Paramètres',
  'Sign out': 'Se déconnecter',
  'Collapse Sidebar': 'Réduire le menu',
  'Expand Sidebar': 'Agrandir le menu',
}

export function translate(text: string, language: Language) {
  return language === 'fr' ? (FRENCH[text] ?? text) : text
}

// Date in the user's chosen numeric format, or null to keep the caller's own wording
export function formatDateSetting(date: Date, settings: AppSettings, withYear = true) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const [day, month, year] = [pad(date.getDate()), pad(date.getMonth() + 1), date.getFullYear()]
  if (settings.dateFormat === 'dmy') return withYear ? `${day}/${month}/${year}` : `${day}/${month}`
  if (settings.dateFormat === 'iso') return withYear ? `${year}-${month}-${day}` : `${month}-${day}`
  return null
}
