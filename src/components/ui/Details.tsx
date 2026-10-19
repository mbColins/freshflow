import type { ReactNode } from 'react'
import { sectionTitle } from '../orders/styles'

export type DetailRow = [label: string, value: ReactNode]

// Missing values show a dash; 0 and false-y numbers still show as themselves
const show = (value: ReactNode) => (value === '' || value === null || value === undefined ? '—' : value)

// Titled block inside a drawer
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={sectionTitle}>{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

// Two-column label / value list
export function DetailGrid({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] text-muted">{label}</dt>
          <dd className="font-semibold break-words text-ink">{show(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

// Same list on a shaded card, as used in drawers
export function DetailBox({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="rounded-lg bg-field p-3">
      <DetailGrid rows={rows} />
    </div>
  )
}
