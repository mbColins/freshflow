import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, CircleCheck, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { secondaryButton } from '../orders/styles'

const TOAST_MS = 4000

export function Kpi({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-line">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-muted">
        <Icon className="size-4 text-brand" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-ink tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{note}</p>
    </div>
  )
}

// A short message at the bottom of the screen that clears itself
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  // Callers pass a fresh arrow each render; keep the latest in a ref so a re-render
  // doesn't restart the timer
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => done.current(), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [message])
  if (!message) return null
  return (
    <p
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
    >
      <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
      {message}
    </p>
  )
}

export function ListLoading({ label }: { label: string }) {
  return (
    <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-line" aria-busy="true">
      <p className="sr-only" role="status">{label}</p>
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="h-14 animate-pulse rounded-md bg-field" />
      ))}
    </div>
  )
}

export function ListError({ title, message, retrying, onRetry }: { title: string; message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      <p className="max-w-md text-xs text-muted">{message}</p>
      <button type="button" onClick={onRetry} disabled={retrying} className={`${secondaryButton} mt-2`}>
        <RotateCcw className="size-3.5" aria-hidden="true" />
        {retrying ? 'Retrying…' : 'Try Again'}
      </button>
    </div>
  )
}

export function ListEmpty({ title, text, action }: { title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      <p className="text-xs text-muted">{text}</p>
      {action && (
        <button type="button" onClick={action.onClick} className={`${secondaryButton} mt-2`}>
          {action.label}
        </button>
      )}
    </div>
  )
}

export function Pager({ page, totalPages, total, busy, onPage }: { page: number; totalPages: number; total: number; busy: boolean; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-[11px] text-muted ring-1 ring-line">
      <span>
        Page {page + 1} of {totalPages} · {total} {total === 1 ? 'request' : 'requests'}
      </span>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page === 0 || busy} className={secondaryButton}>
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Previous
        </button>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page + 1 >= totalPages || busy} className={secondaryButton}>
          Next
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
