import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Download, Ellipsis, GitCompareArrows, LayoutGrid, Plus, RotateCcw, Table2, Upload } from 'lucide-react'
import {
  BranchGrid,
  BranchKpis,
  BranchTable,
  BranchToolbar,
  StatusSummary,
} from '../components/branches/BranchesListParts'
import type { BranchSort } from '../components/branches/BranchesListParts'
import { CompareDialog } from '../components/branches/BranchDialogs'
import BranchWizard from '../components/branches/BranchWizard'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import Menu, { MenuItem } from '../components/ui/Menu'
import { BRANCH_PERMISSIONS, EMPTY_BRANCH_FILTERS } from '../constants/branches'
import { ORDER_ROLES } from '../constants/orders'
import { useBranchesQuery, useChangeBranch } from '../hooks/useBranches'
import useLocalStorage from '../hooks/useLocalStorage'
import useDeleteBranch from '../hooks/useDeleteBranch'
import useSaveBranch from '../hooks/useSaveBranch'
import { useCreateBranchMutation } from '../services/branchApi'
import type { Branch, BranchFilters, BranchProfile } from '../types/branch'
import type { OrderRole } from '../types/order'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import {
  branchesToCsv,
  compareBranches,
  emptyProfile,
  importBranches,
  matchesBranchFilters,
  nextBranchCode,
  profileOf,
} from '../utils/branches'
import type { BranchSortKey } from '../utils/branches'
import { downloadFile } from '../utils/orders'

const TOAST_MS = 4000
const NO_BRANCHES: Branch[] = []
const IMPORT_TEMPLATE =
  'name,code,city,district,address,phone,email,manager\r\nDeido Branch,,Douala,Deido,24 Rue Deido,+237 6XX XXX XXX,deido@example.com,Full Name\r\n'

type WizardState = { mode: 'create' } | { mode: 'edit'; id: string }
type BranchView = 'grid' | 'table'

function BranchesPage() {
  const { data, isLoading, isError, isFetching, error: loadError, refetch } = useBranchesQuery()
  const branches = data?.items ?? NO_BRANCHES
  const changeBranch = useChangeBranch()
  const [createBranch] = useCreateBranchMutation()
  const confirmDelete = useDeleteBranch()
  const [filters, setFilters] = useState<BranchFilters>(EMPTY_BRANCH_FILTERS)
  const [sort, setSort] = useState<BranchSort>({ key: 'name', descending: false })
  const [wizard, setWizard] = useState<WizardState | null>(null)
  const [comparing, setComparing] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const { save: saveBranch, error: saveError, reset: resetSave } = useSaveBranch()
  const [role, setRole] = useLocalStorage<OrderRole>('branches.role', 'admin')
  const [view, setView] = useLocalStorage<BranchView>('branches.view', 'grid')
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const permissions = BRANCH_PERMISSIONS[role]
  // Everything except the status filter, so the status cards keep their counts
  const scoped = branches.filter((branch) => matchesBranchFilters(branch, { ...filters, status: '' }))
  const filtered = scoped
    .filter((branch) => !filters.status || branch.status === filters.status)
    .sort((a, b) => compareBranches(a, b, sort.key, filters.period) * (sort.descending ? -1 : 1))
  const filtersActive =
    Object.entries(filters).some(([key, value]) => key !== 'period' && value !== '') ||
    filters.period !== EMPTY_BRANCH_FILTERS.period
  const cities = [...new Set(branches.map(({ city }) => city))].sort()
  const editing = wizard?.mode === 'edit' ? branches.find(({ id }) => id === wizard.id) : undefined
  const patchFilters = (patch: Partial<BranchFilters>) => setFilters({ ...filters, ...patch })

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

  async function handleSave(profile: BranchProfile, logo: File | null) {
    // The list reloads on its own; on failure the wizard stays open with the error
    if (!(await saveBranch(editing, profile, logo))) return
    setToast(editing ? `${profile.name} updated` : `${profile.name} created as ${profile.id}`)
    setWizard(null)
  }

  function handleSetActive(id: string, active: boolean) {
    const branch = branches.find((item) => item.id === id)!
    if (active) {
      void changeBranch(branch, (current) => ({ ...current, status: 'active', statusNote: '' })).then((ok) =>
        setToast(ok ? `${branch.name} activated` : `Couldn’t activate ${branch.name}. Try again.`),
      )
      return
    }
    setConfirm({
      title: `Deactivate ${branch.name}?`,
      body: `The branch stops accepting new orders and disappears from branch pickers. ${branch.stats.activeOrders} active orders stay open until completed, and all history is kept.`,
      confirmLabel: 'Deactivate',
      destructive: true,
      onConfirm: async () => {
        const ok = await changeBranch(branch, (current) => ({ ...current, status: 'inactive' }))
        setToast(ok ? `${branch.name} deactivated` : `Couldn’t deactivate ${branch.name}. Try again.`)
      },
    })
  }

  function handleSort(key: BranchSortKey) {
    setSort({ key, descending: sort.key === key ? !sort.descending : key !== 'name' && key !== 'status' })
  }

  function handleExport() {
    downloadFile('branches.csv', branchesToCsv(filtered, filters.period, permissions.financials), 'text/csv;charset=utf-8')
    setToast(`Exported ${filtered.length} ${filtered.length === 1 ? 'branch' : 'branches'}`)
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const { added, skipped, missingHeader } = importBranches(await file.text(), branches)
    if (missingHeader) {
      setToast('Import failed: the file needs a header row with a “name” column')
      return
    }
    // One POST per row, in order, so codes are claimed predictably
    let created = 0
    for (const branch of added) {
      try {
        await createBranch({ profile: profileOf(branch), logo: null }).unwrap()
        created += 1
      } catch {
        // Counted below as refused
      }
    }
    const refused = added.length - created
    setToast(
      `Imported ${created} ${created === 1 ? 'branch' : 'branches'} as inactive` +
        (skipped ? `, skipped ${skipped} (no name or duplicate code)` : '') +
        (refused ? `, ${refused} refused by the server` : ''),
    )
  }

  const listActions = {
    permissions,
    period: filters.period,
    onEdit: (id: string) => setWizard({ mode: 'edit', id }),
    onSetActive: handleSetActive,
    onDelete: (id: string) => {
      const branch = branches.find((item) => item.id === id)
      if (branch) setConfirm(confirmDelete(branch, (message) => setToast(message)))
    },
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Branches</h1>
            <p className="text-xs text-muted">
              Manage your laundry locations, operations, and performance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setComparing(true)} className={secondaryButton}>
              <GitCompareArrows className="size-4 text-muted" aria-hidden="true" />
              Compare Branches
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
                    <MenuItem
                      onSelect={() => {
                        close()
                        downloadFile('branches-import-template.csv', IMPORT_TEMPLATE, 'text/csv;charset=utf-8')
                      }}
                    >
                      Download import template
                    </MenuItem>
                  )}
                </Menu>
                <button
                  type="button"
                  onClick={() => setWizard({ mode: 'create' })}
                  className={`${primaryButton} max-md:hidden`}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add Branch
                </button>
              </>
            )}
          </div>
        </div>
        <label className="flex w-fit items-center gap-2 text-[11px] whitespace-nowrap text-muted">
          Viewing as
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as OrderRole)}
            className={`${fieldClass} h-8 w-auto!`}
          >
            {ORDER_ROLES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <BranchKpis
        branches={scoped}
        filters={filters}
        permissions={permissions}
        onStatus={(status) => patchFilters({ status })}
      />

      <StatusSummary
        branches={scoped}
        selected={filters.status}
        onSelect={(status) => patchFilters({ status })}
      />

      <section className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">
            All Branches{' '}
            <span className="font-normal text-muted">
              ({filtered.length} of {branches.length})
            </span>
          </h2>
          <div role="group" aria-label="Branch view" className="inline-flex gap-0.5 rounded-md bg-field p-0.5">
            {(
              [
                ['grid', 'Grid', LayoutGrid],
                ['table', 'Table', Table2],
              ] as const
            ).map(([value, label, Icon]) => (
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
        <BranchToolbar
          searchRef={searchRef}
          filters={filters}
          cities={cities}
          filtersActive={filtersActive}
          onChange={patchFilters}
          onReset={() => setFilters(EMPTY_BRANCH_FILTERS)}
        />
      </section>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <p className="sr-only" role="status">Loading branches…</p>
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-56 animate-pulse rounded-xl bg-white ring-1 ring-line" />
          ))}
        </div>
      ) : isError && branches.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the branches</h2>
          <p className="max-w-md text-xs text-muted">
            {serverMessage(loadError) ??
              (errorMessage(loadError, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE)}
          </p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className={`${secondaryButton} mt-2`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No branches yet</h2>
          <p className="text-xs text-muted">Branches you add or import appear here.</p>
          {permissions.manage && (
            <button type="button" onClick={() => setWizard({ mode: 'create' })} className={`${secondaryButton} mt-2`}>
              <Plus className="size-3.5" aria-hidden="true" />
              Add Branch
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">No branches match these filters</h2>
          <p className="text-xs text-muted">Try a different search, status, city or performance level.</p>
          <button type="button" onClick={() => setFilters(EMPTY_BRANCH_FILTERS)} className={`${secondaryButton} mt-2`}>
            Reset Filters
          </button>
        </div>
      ) : view === 'grid' ? (
        <BranchGrid branches={filtered} {...listActions} />
      ) : (
        <BranchTable branches={filtered} sort={sort} onSort={handleSort} {...listActions} />
      )}

      {permissions.manage && (
        <button
          type="button"
          onClick={() => setWizard({ mode: 'create' })}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Branch
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

      {wizard && (wizard.mode === 'create' || editing) && (
        <BranchWizard
          key={editing?.id ?? 'new'}
          mode={wizard.mode}
          initial={editing ?? emptyProfile(nextBranchCode(branches))}
          takenCodes={branches.map(({ id }) => id).filter((id) => id !== editing?.id)}
          error={saveError}
          onClose={() => {
            resetSave()
            setWizard(null)
          }}
          onSave={handleSave}
        />
      )}
      {comparing && (
        <CompareDialog branches={branches} permissions={permissions} onClose={() => setComparing(false)} />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default BranchesPage
