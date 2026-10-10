import { CircleAlert, Inbox, Plus, RefreshCw } from 'lucide-react'
import { primaryButton, secondaryButton } from './styles'

export function OrdersSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading orders">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-[76px] rounded-xl bg-white ring-1 ring-line">
            <div className="m-3 h-2.5 w-16 rounded bg-field" />
            <div className="mx-3 h-5 w-10 rounded bg-field" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 rounded-xl bg-white p-2 ring-1 ring-line">
        {Array.from({ length: 9 }, (_, index) => (
          <div key={index} className="h-12 flex-1 rounded-lg bg-field" />
        ))}
      </div>
      <div className="h-24 rounded-xl bg-white ring-1 ring-line" />
      <div className="rounded-xl bg-white ring-1 ring-line">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0"
          >
            <div className="size-4 rounded bg-field" />
            <div className="h-3 w-24 rounded bg-field" />
            <div className="h-3 w-32 rounded bg-field" />
            <div className="h-3 flex-1 rounded bg-field" />
            <div className="h-5 w-20 rounded bg-field" />
            <div className="h-3 w-24 rounded bg-field max-sm:hidden" />
          </div>
        ))}
      </div>
    </div>
  )
}

type EmptyStateProps = {
  filtered: boolean
  canCreate: boolean
  onClearFilters: () => void
  onNewOrder: () => void
}

export function OrdersEmptyState({
  filtered,
  canCreate,
  onClearFilters,
  onNewOrder,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
      <Inbox className="size-8 text-muted/60" aria-hidden="true" />
      <h2 className="text-sm font-bold text-ink">
        {filtered ? 'No Orders' : 'No Orders Today'}
      </h2>
      <p className="text-xs text-muted">
        {filtered
          ? 'No orders match your current filters.'
          : 'Your laundry is quiet today.'}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {filtered && (
          <button type="button" onClick={onClearFilters} className={secondaryButton}>
            Clear Filters
          </button>
        )}
        {canCreate && (
          <button type="button" onClick={onNewOrder} className={primaryButton}>
            <Plus className="size-4" aria-hidden="true" />
            Create New Order
          </button>
        )}
      </div>
    </div>
  )
}

export function OrdersErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line"
    >
      <CircleAlert className="size-8 text-danger" aria-hidden="true" />
      <h2 className="text-sm font-bold text-ink">Unable to load orders.</h2>
      <p className="text-xs text-muted">
        Something went wrong while retrieving order information.
      </p>
      <button type="button" onClick={onRetry} className={`${primaryButton} mt-2`}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Retry
      </button>
    </div>
  )
}
