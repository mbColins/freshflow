import type { ColumnType, ReportColumn } from '../services/reportsApi'

// How a report cell, total or chart value reads. Values arrive raw: the
// column's type says what they are

const number = (value: unknown) => {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

const group = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits })

// "averageTicket" -> "Average ticket"
export function humanize(key: string) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function formatReportValue(value: unknown, type: ColumnType, currency: string) {
  if (value === null || value === undefined || value === '') return '—'
  switch (type) {
    case 'MONEY': {
      const amount = number(value)
      return amount === null ? String(value) : `${currency} ${group(amount, 0)}`
    }
    case 'PERCENT': {
      const percent = number(value)
      return percent === null ? String(value) : `${group(percent, 1)}%`
    }
    case 'NUMBER': {
      const amount = number(value)
      return amount === null ? String(value) : group(amount)
    }
    case 'DATE': {
      const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    case 'DATETIME': {
      const date = new Date(String(value))
      return Number.isNaN(date.getTime())
        ? String(value)
        : `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    }
    default:
      return String(value)
  }
}

export const isNumeric = (type: ColumnType) => type === 'NUMBER' || type === 'MONEY' || type === 'PERCENT'

// The totals the reports API sends that aren't columns, so carry no type of their own.
// Exact keys, not a pattern on the name: `totalOrders` or `ticketCount` are counts
const MONEY_TOTALS = new Set([
  'revenue', 'averageTicket', 'discounts', 'tax', 'spend', 'value', 'collected', 'refunded', 'net',
  'variance', 'cost', 'balance', 'monthlyRecurringRevenue',
])
const PERCENT_TOTALS = new Set(['lateRate', 'passRate', 'reprocessRate'])

// A total's key may not be a column's: use the column's type when it is. Otherwise the
// known totals above; anything else is a plain number (the safe way to be wrong)
export function totalType(key: string, columns: ReportColumn[]): ColumnType {
  const column = columns.find((item) => item.key === key)
  if (column) return column.type
  if (PERCENT_TOTALS.has(key)) return 'PERCENT'
  // The aged-balance report adds one total per band (band_0-7, …), each an amount
  if (MONEY_TOTALS.has(key) || key.startsWith('band_')) return 'MONEY'
  return 'NUMBER'
}

// The first day of the range: 30 days back, as yyyy-MM-dd
export const isoDay = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000)
