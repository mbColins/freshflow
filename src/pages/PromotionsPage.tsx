import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BarChart3, CalendarDays, Download, Ellipsis, LayoutGrid, Plus, Table2, Upload } from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import {
  DiscountSimulator,
  PromotionDrawer,
  StackingDialog,
} from '../components/promotions/PromotionDialogs'
import {
  PerformanceRegister,
  PromotionCalendar,
  PromotionGrid,
  PromotionKpis,
  PromotionStatusSummary,
  PromotionTable,
  PromotionToolbar,
  StackingBanner,
} from '../components/promotions/PromotionsListParts'
import type { PromotionActions, PromotionSort } from '../components/promotions/PromotionsListParts'
import PromotionWizard from '../components/promotions/PromotionWizard'
import Menu, { MenuItem } from '../components/ui/Menu'
import { CURRENT_USER, ORDER_ROLES } from '../constants/orders'
import {
  DEFAULT_STACKING,
  EMPTY_PROMOTION_FILTERS,
  PROMOTION_PERMISSIONS,
} from '../constants/promotions'
import { SAMPLE_PROMOTIONS } from '../constants/samplePromotions'
import useBranches from '../hooks/useBranches'
import useLocalStorage from '../hooks/useLocalStorage'
import useNow from '../hooks/useNow'
import type { OrderRole } from '../types/order'
import type {
  Promotion,
  PromotionDraft,
  PromotionFilters,
  StackingPolicy,
} from '../types/promotion'
import { downloadFile } from '../utils/orders'
import {
  comparePromotions,
  createPromotion,
  emptyDraft,
  getPromotionStatus,
  importPromotions,
  matchesPromotionFilters,
  nextPromotionId,
  promotionsToCsv,
  suggestCode,
  toDateKey,
  toDraft,
  withEvent,
} from '../utils/promotions'
import type { PromotionSortKey } from '../utils/promotions'

const TOAST_MS = 4000
const IMPORT_TEMPLATE =
  'name,code,type,value,start,end\r\nHarmattan Fresh,HARMATTAN15,percent,15,2026-12-01,2026-12-31\r\nWelcome Back,BACK1000,amount,1000,2026-11-01,2026-11-30\r\n'

type PromotionView = 'grid' | 'table' | 'calendar'
type WizardState = { mode: 'create'; draft: PromotionDraft } | { mode: 'edit'; id: string }

const VIEWS = [
  ['grid', 'Grid', LayoutGrid],
  ['table', 'Table', Table2],
  ['calendar', 'Calendar', CalendarDays],
] as const

function PromotionsPage() {
  const now = useNow()
  const branches = useBranches()
  // TODO: replace this in-memory list with the promotions API
  const [promotions, setPromotions] = useState(SAMPLE_PROMOTIONS)
  const [filters, setFilters] = useState<PromotionFilters>(EMPTY_PROMOTION_FILTERS)
  const [sort, setSort] = useState<PromotionSort>({ key: 'status', descending: false })
  const [openId, setOpenId] = useState<string | null>(null)
  const [wizard, setWizard] = useState<WizardState | null>(null)
  const [stackingOpen, setStackingOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [role, setRole] = useLocalStorage<OrderRole>('promotions.role', 'admin')
  const [view, setView] = useLocalStorage<PromotionView>('promotions.view', 'grid')
  const [policy, setPolicy] = useLocalStorage<StackingPolicy>('promotions.stacking', DEFAULT_STACKING)
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLElement>(null)
  const analyticsRef = useRef<HTMLDivElement>(null)

  const permissions = PROMOTION_PERMISSIONS[role]
  const branchOptions = branches.map(({ id, name }) => ({ id, name }))
  // Everything except the status filter, so the status cards keep their counts
  const scoped = promotions.filter((promotion) => matchesPromotionFilters(promotion, { ...filters, status: '' }, now))
  const filtered = scoped
    .filter((promotion) => !filters.status || getPromotionStatus(promotion, now) === filters.status)
    .sort((a, b) => comparePromotions(a, b, sort.key, now) * (sort.descending ? -1 : 1))
  const filtersActive = Object.values(filters).some((value) => value !== '')
  const openPromotion = promotions.find(({ id }) => id === openId) ?? null
  const editing = wizard?.mode === 'edit' ? promotions.find(({ id }) => id === wizard.id) : undefined
  const patchFilters = (patch: Partial<PromotionFilters>) => setFilters({ ...filters, ...patch })

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing =
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing || document.querySelector('dialog[open]')) return
      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const update = (id: string, change: (promotion: Promotion) => Promotion, event: string) =>
    setPromotions((current) =>
      current.map((promotion) => (promotion.id === id ? withEvent(change(promotion), CURRENT_USER, event) : promotion)),
    )
  const find = (id: string) => promotions.find((promotion) => promotion.id === id)!

  function handleSave(draft: PromotionDraft, publish: boolean) {
    const state = publish ? 'published' : draft.state
    const scheduled = draft.startAt > toDateKey(now)
    if (wizard?.mode === 'edit') {
      update(draft.id, (promotion) => ({ ...promotion, ...draft, state }), publish ? 'Published the promotion' : 'Edited the promotion')
      setToast(publish ? `${draft.name} ${scheduled ? 'scheduled' : 'published'}` : `${draft.name} updated`)
    } else {
      setPromotions([createPromotion({ ...draft, state }, CURRENT_USER), ...promotions])
      setToast(publish ? `${draft.name} ${scheduled ? 'scheduled' : 'is now live'}` : `${draft.name} saved as a draft`)
    }
    setWizard(null)
  }

  function handleTogglePause(id: string) {
    const promotion = find(id)
    const paused = promotion.state === 'paused'
    update(id, (current) => ({ ...current, state: paused ? 'published' : 'paused' }), paused ? 'Resumed the promotion' : 'Paused the promotion')
    setToast(`${promotion.name} ${paused ? 'resumed' : 'paused'}`)
  }

  function handleDuplicate(id: string) {
    const source = find(id)
    setOpenId(null)
    setWizard({
      mode: 'create',
      draft: {
        ...toDraft(source),
        id: nextPromotionId(promotions),
        name: `${source.name} (copy)`,
        code: source.code ? suggestCode(source.name, 0, promotions.map(({ code }) => code)) : '',
        state: 'draft',
      },
    })
  }

  function handleArchive(id: string) {
    const promotion = find(id)
    if (promotion.state === 'archived') {
      update(id, (current) => ({ ...current, state: 'draft' }), 'Restored the promotion as a draft')
      setToast(`${promotion.name} restored as a draft`)
      return
    }
    setConfirm({
      title: `Archive ${promotion.name}?`,
      body: 'The promotion stops applying to new orders and its code stops working. Its history and results are kept, and it can be restored as a draft.',
      confirmLabel: 'Archive',
      destructive: true,
      onConfirm: () => {
        update(id, (current) => ({ ...current, state: 'archived' }), 'Archived the promotion')
        setOpenId(null)
        setToast(`${promotion.name} archived`)
      },
    })
  }

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setToast(`Code ${code} copied`)
    } catch {
      setToast(`Couldn’t copy. The code is ${code}`)
    }
  }

  function handleSort(key: PromotionSortKey) {
    setSort({ key, descending: sort.key === key ? !sort.descending : !['name', 'status', 'start'].includes(key) })
  }

  function handleExport() {
    downloadFile('promotions.csv', promotionsToCsv(filtered, now, permissions.financials), 'text/csv;charset=utf-8')
    setToast(`Exported ${filtered.length} ${filtered.length === 1 ? 'promotion' : 'promotions'}`)
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const { added, skipped, missingHeader } = importPromotions(await file.text(), promotions, CURRENT_USER, now)
    if (missingHeader) {
      setToast('Import failed: the file needs a header row with a “name” column')
      return
    }
    if (added.length > 0) setPromotions([...added, ...promotions])
    setToast(
      `Imported ${added.length} ${added.length === 1 ? 'promotion' : 'promotions'} as drafts` +
        (skipped ? `, skipped ${skipped} (missing name or value, or duplicate code)` : ''),
    )
  }

  function showView(next: PromotionView) {
    setView(next)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const actions: PromotionActions = {
    permissions,
    now,
    branches: branchOptions,
    onView: setOpenId,
    onEdit: (id) => {
      setOpenId(null)
      setWizard({ mode: 'edit', id })
    },
    onTogglePause: handleTogglePause,
    onDuplicate: handleDuplicate,
    onArchive: handleArchive,
    onCopyCode: handleCopyCode,
  }
  const openCreate = () => setWizard({ mode: 'create', draft: emptyDraft(nextPromotionId(promotions), now) })

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Promotions</h1>
            <p className="text-xs text-muted">
              Create campaigns, reward customers, and drive more laundry orders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => showView('calendar')} className={secondaryButton}>
              <CalendarDays className="size-4 text-muted" aria-hidden="true" />
              Campaign Calendar
            </button>
            <button
              type="button"
              onClick={() => analyticsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={secondaryButton}
            >
              <BarChart3 className="size-4 text-muted" aria-hidden="true" />
              Analytics
            </button>
            <button type="button" onClick={handleExport} className={secondaryButton}>
              <Download className="size-4 text-muted" aria-hidden="true" />
              Export
            </button>
            {permissions.manage && (
              <>
                <button type="button" onClick={() => fileRef.current?.click()} className={secondaryButton}>
                  <Upload className="size-4 text-muted" aria-hidden="true" />
                  Import
                </button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" />
                <Menu
                  label="More actions"
                  trigger={<Ellipsis className="size-4" aria-hidden="true" />}
                  triggerClassName={`${secondaryButton} px-2.5`}
                >
                  {(close) => (
                    <>
                      <MenuItem
                        onSelect={() => {
                          close()
                          downloadFile('promotions-import-template.csv', IMPORT_TEMPLATE, 'text/csv;charset=utf-8')
                        }}
                      >
                        Download import template
                      </MenuItem>
                      <MenuItem
                        onSelect={() => {
                          close()
                          setStackingOpen(true)
                        }}
                      >
                        Stacking rules
                      </MenuItem>
                    </>
                  )}
                </Menu>
                <button type="button" onClick={openCreate} className={`${primaryButton} max-md:hidden`}>
                  <Plus className="size-4" aria-hidden="true" />
                  Create Promotion
                </button>
              </>
            )}
          </div>
        </div>
        <label className="flex w-fit items-center gap-2 text-[11px] whitespace-nowrap text-muted">
          Viewing as
          <select value={role} onChange={(event) => setRole(event.target.value as OrderRole)} className={`${fieldClass} h-8 w-auto!`}>
            {ORDER_ROLES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PromotionKpis
        promotions={scoped}
        now={now}
        permissions={permissions}
        selected={filters.status}
        onStatus={(status) => patchFilters({ status })}
      />

      <PromotionStatusSummary
        promotions={scoped}
        now={now}
        selected={filters.status}
        onSelect={(status) => patchFilters({ status })}
      />

      <StackingBanner
        promotions={promotions}
        now={now}
        policy={policy}
        canManage={permissions.manage}
        onConfigure={() => setStackingOpen(true)}
      />

      <section ref={listRef} className="scroll-mt-20 space-y-3 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">
            All Promotions{' '}
            <span className="font-normal text-muted">
              ({filtered.length} of {promotions.length})
            </span>
          </h2>
          <div role="group" aria-label="Promotion view" className="inline-flex gap-0.5 rounded-md bg-field p-0.5">
            {VIEWS.map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  view === value ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <PromotionToolbar
          searchRef={searchRef}
          filters={filters}
          branches={branchOptions}
          filtersActive={filtersActive}
          onChange={patchFilters}
          onReset={() => setFilters(EMPTY_PROMOTION_FILTERS)}
        />
      </section>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No promotions match these filters</h2>
          <p className="text-xs text-muted">Try a different search, status, type or date range.</p>
          <button type="button" onClick={() => setFilters(EMPTY_PROMOTION_FILTERS)} className={`${secondaryButton} mt-2`}>
            Reset Filters
          </button>
        </div>
      ) : view === 'grid' ? (
        <PromotionGrid promotions={filtered} {...actions} />
      ) : view === 'table' ? (
        <PromotionTable promotions={filtered} sort={sort} onSort={handleSort} {...actions} />
      ) : (
        <PromotionCalendar promotions={filtered} now={now} onView={setOpenId} />
      )}

      <div ref={analyticsRef} className="grid scroll-mt-20 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <PerformanceRegister promotions={scoped} permissions={permissions} onView={setOpenId} />
        </div>
        <DiscountSimulator promotions={promotions} branches={branchOptions} now={now} showMargin={permissions.financials} />
      </div>

      {permissions.manage && (
        <button
          type="button"
          onClick={openCreate}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Create Promotion
        </button>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg max-md:bottom-20"
        >
          {toast}
        </p>
      )}

      {openPromotion && (
        <PromotionDrawer
          key={openPromotion.id}
          promotion={openPromotion}
          now={now}
          permissions={permissions}
          branches={branchOptions}
          onClose={() => setOpenId(null)}
          onEdit={actions.onEdit}
          onTogglePause={handleTogglePause}
          onDuplicate={handleDuplicate}
        />
      )}
      {wizard && (wizard.mode === 'create' || editing) && (
        <PromotionWizard
          key={wizard.mode === 'create' ? wizard.draft.id : wizard.id}
          mode={wizard.mode}
          initial={wizard.mode === 'create' ? wizard.draft : toDraft(editing!)}
          takenCodes={promotions
            .filter(({ id, code }) => code && id !== editing?.id)
            .map(({ code }) => code)}
          branches={branchOptions}
          now={now}
          onClose={() => setWizard(null)}
          onSave={handleSave}
        />
      )}
      {stackingOpen && (
        <StackingDialog
          policy={policy}
          onClose={() => setStackingOpen(false)}
          onSave={(next) => {
            setPolicy(next)
            setStackingOpen(false)
            setToast('Stacking rules saved')
          }}
        />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default PromotionsPage
