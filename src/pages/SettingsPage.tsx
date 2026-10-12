import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Check,
  Globe,
  LayoutPanelLeft,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sun,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fieldClass, labelClass, primaryButton, secondaryButton } from '../components/orders/styles'
import Panel from '../components/ui/Panel'
import SegmentedControl from '../components/ui/SegmentedControl'
import {
  ACCENTS,
  AUTO_LOCK_OPTIONS,
  DATE_FORMATS,
  DEFAULT_SETTINGS,
  LANGUAGES,
  SETTING_LABELS,
  START_PAGES,
  TEXT_SCALES,
  THEMES,
  TIME_FORMATS,
} from '../constants/settings'
import useSettings, { getSettings, settingsStore } from '../hooks/useSettings'
import type { AppSettings, DateFormat, Language, TextScale, ThemeMode, TimeFormat } from '../types/settings'
import { formatDate } from '../utils/customers'
import { formatTime } from '../utils/orders'
import { applySettings } from '../utils/settings'

const TOAST_MS = 4000

const THEME_ICONS: Record<ThemeMode, LucideIcon> = { light: Sun, dark: Moon, system: Monitor }

// Miniature of the interface in each theme
function ThemePreview({ mode }: { mode: ThemeMode }) {
  const half = (dark: boolean) => (
    <span className={`flex flex-1 flex-col gap-1 p-2 ${dark ? 'bg-slate-900' : 'bg-slate-100'}`}>
      <span className={`h-1.5 w-8 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
      <span className={`h-5 rounded ${dark ? 'bg-slate-800' : 'bg-slate-50'}`} />
      <span className="h-1.5 w-12 rounded-full bg-brand" />
    </span>
  )
  return (
    <span className="flex h-16 overflow-hidden rounded-md ring-1 ring-line" aria-hidden="true">
      {mode !== 'dark' && half(false)}
      {mode !== 'light' && half(true)}
    </span>
  )
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string
  help: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-field px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink">{label}</p>
        <p className="text-[11px] text-muted">{help}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none ${
          checked ? 'bg-brand' : 'bg-muted/40'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-slate-50 shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}

function Select<T extends string | number>({
  id,
  label,
  help,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  help?: ReactNode
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(options.find((option) => String(option.value) === event.target.value)!.value)}
        className={fieldClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help && <p className="mt-1 text-[11px] text-muted">{help}</p>}
    </div>
  )
}

function SettingsPage() {
  const saved = useSettings()
  const [draft, setDraft] = useState(saved)
  const [toast, setToast] = useState<string | null>(null)
  const patch = (change: Partial<AppSettings>) => setDraft((current) => ({ ...current, ...change }))
  const keys = Object.keys(SETTING_LABELS) as (keyof AppSettings)[]
  const changed = keys.filter((key) => draft[key] !== saved[key])
  const isDefault = keys.every((key) => draft[key] === DEFAULT_SETTINGS[key])

  // Preview appearance changes straight away; leaving without saving puts the saved look back
  useEffect(() => {
    applySettings(draft)
    return () => applySettings(getSettings())
  }, [draft])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  function save() {
    settingsStore.save(draft)
    setToast('Settings saved')
  }

  // Samples use the saved formats, so they show what the rest of the app shows today
  const sample = new Date(2026, 9, 24, 14, 30).toISOString()

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">Application Settings</h1>
            <p className="text-xs text-muted">
              Language, appearance, formats and default behaviors for this browser.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={isDefault} onClick={() => setDraft(DEFAULT_SETTINGS)} className={secondaryButton}>
            <RotateCcw className="size-4 text-muted" aria-hidden="true" />
            Reset to Defaults
          </button>
          <button type="button" disabled={changed.length === 0} onClick={save} className={primaryButton}>
            <Check className="size-4" aria-hidden="true" />
            Save Changes
          </button>
        </div>
      </div>

      <Panel title="Appearance & Theme" subtitle="Changes preview immediately and are kept once you save" icon={Palette}>
        <div className="space-y-5">
          <div>
            <p className={labelClass}>Theme</p>
            <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
              {THEMES.map(({ value, label, help }) => {
                const Icon = THEME_ICONS[value]
                const selected = draft.theme === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch({ theme: value })}
                    className={`rounded-lg p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                      selected ? 'bg-brand/5 ring-2 ring-brand' : 'ring-1 ring-line hover:bg-field'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-ink">
                      <Icon className="size-4 text-muted" aria-hidden="true" />
                      {label}
                      {selected && <Check className="ml-auto size-4 text-brand" aria-hidden="true" />}
                    </span>
                    <span className="mt-2 block">
                      <ThemePreview mode={value} />
                    </span>
                    <span className="mt-2 block text-[11px] text-muted">{help}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className={labelClass}>Accent color</p>
              <p className="mb-2 text-[11px] text-muted">Used for buttons, links, the active menu item and highlights.</p>
              <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2">
                {ACCENTS.map(({ id, label, color }) => {
                  const selected = draft.accent === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={label}
                      title={label}
                      onClick={() => patch({ accent: id })}
                      className={`flex size-9 items-center justify-center rounded-full transition focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none ${
                        selected ? 'ring-2 ring-ink ring-offset-2' : ''
                      }`}
                      style={{ background: color }}
                    >
                      {selected && <Check className="size-4 text-white" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className={labelClass}>Text size</p>
              <p className="mb-2 text-[11px] text-muted">Makes text and controls larger for counter screens viewed from a distance.</p>
              <SegmentedControl
                label="Text size"
                options={TEXT_SCALES.map(({ value, label }) => ({ value: String(value), label }))}
                value={String(draft.textScale)}
                onChange={(value) => patch({ textScale: Number(value) as TextScale })}
              />
            </div>
          </div>

          <Toggle
            label="Reduce motion"
            help="Turns off transitions and smooth scrolling."
            checked={draft.reduceMotion}
            onChange={(reduceMotion) => patch({ reduceMotion })}
          />
        </div>
      </Panel>

      <Panel title="Language & Region" subtitle="How the menu, dates and times are shown" icon={Globe}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            id="settings-language"
            label="Language"
            value={draft.language}
            options={LANGUAGES}
            onChange={(language: Language) => patch({ language })}
            help="French currently covers the navigation menu. Other screens stay in English."
          />
          <Select
            id="settings-date"
            label="Date format"
            value={draft.dateFormat}
            options={DATE_FORMATS}
            onChange={(dateFormat: DateFormat) => patch({ dateFormat })}
            help={<>Saved format shows as <span className="font-semibold text-ink">{formatDate(sample)}</span></>}
          />
          <Select
            id="settings-time"
            label="Time format"
            value={draft.timeFormat}
            options={TIME_FORMATS}
            onChange={(timeFormat: TimeFormat) => patch({ timeFormat })}
            help={<>Saved format shows as <span className="font-semibold text-ink">{formatTime(sample)}</span></>}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Currency is fixed to XAF (Central African CFA franc) for the whole business.
        </p>
      </Panel>

      <Panel title="Layout" subtitle="How the navigation menu behaves" icon={LayoutPanelLeft}>
        <div className="grid gap-2 md:grid-cols-2">
          <Toggle
            label="Show count badges in the menu"
            help="The numbers beside Orders and Inventory."
            checked={draft.showNavBadges}
            onChange={(showNavBadges) => patch({ showNavBadges })}
          />
          <Toggle
            label="Start with the menu collapsed"
            help="Shows icons only on wide screens, leaving more room for content."
            checked={draft.sidebarCollapsed}
            onChange={(sidebarCollapsed) => patch({ sidebarCollapsed })}
          />
        </div>
      </Panel>

      <Panel title="Session" subtitle="What happens when you sign in and when you step away" icon={LockKeyhole}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="settings-start"
            label="Start screen"
            value={draft.startPage}
            options={START_PAGES}
            onChange={(startPage) => patch({ startPage })}
            help="Opens after you sign in and verify your code."
          />
          <Select
            id="settings-lock"
            label="Auto-lock"
            value={draft.autoLockMinutes}
            options={AUTO_LOCK_OPTIONS}
            onChange={(autoLockMinutes) => patch({ autoLockMinutes })}
            help="Returns to the sign-in screen after this long without mouse or keyboard activity."
          />
        </div>
      </Panel>

      <p className="text-[11px] text-muted">
        These settings are stored in this browser. They don’t follow you to another device yet.
      </p>

      {changed.length > 0 && (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-lg ring-1 ring-line"
        >
          <p className="min-w-0 flex-1 basis-48 text-xs text-ink">
            <span className="font-bold">Unsaved changes:</span>{' '}
            <span className="text-muted">{changed.map((key) => SETTING_LABELS[key]).join(', ')}</span>
          </p>
          <button type="button" onClick={() => setDraft(saved)} className={secondaryButton}>
            Discard
          </button>
          <button type="button" onClick={save} className={primaryButton}>
            <Check className="size-4" aria-hidden="true" />
            Save Changes
          </button>
        </div>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}
    </>
  )
}

export default SettingsPage
