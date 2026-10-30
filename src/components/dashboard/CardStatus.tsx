import type { ReactNode } from 'react'
import { Inbox, RotateCcw } from 'lucide-react'
import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../../utils/apiErrors'
import { secondaryButton } from '../orders/styles'

// What a card shows while its own request loads, fails or comes back empty.
// The "Normal / Skeleton / Empty / Error" switch in the header is separate:
// it previews DashboardCard's states.

export function CardLoading({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <ul className="space-y-2" aria-busy="true">
      <li className="sr-only" role="status">{label}</li>
      {Array.from({ length: rows }, (_, key) => (
        <li key={key} className="h-14 animate-pulse rounded-lg bg-field" />
      ))}
    </ul>
  )
}

type CardErrorProps = { title: string; error: FetchBaseQueryError | SerializedError | undefined; retrying: boolean; onRetry: () => void }

export function CardError({ title, error, retrying, onRetry }: CardErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="max-w-xs text-xs text-muted">
        {serverMessage(error) ?? errorMessage(error, 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE}
      </p>
      <button type="button" onClick={onRetry} disabled={retrying} className={`${secondaryButton} mt-1`}>
        <RotateCcw className="size-3.5" aria-hidden="true" />
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  )
}

export function CardEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Inbox className="size-6 text-muted/60" aria-hidden="true" />
      <p className="text-sm font-bold text-ink">{title}</p>
      {children && <p className="max-w-xs text-xs text-muted">{children}</p>}
    </div>
  )
}
