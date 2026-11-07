import type { ApiResponse } from '../types/api'
import { api } from './api'

// Reports (/reports): one API for every report. Needs REPORTS:VIEW (owner and
// managers always have it); exporting needs REPORTS:EXPORT. A branch user is
// limited to their own branch.

export type ReportParam = {
  key: string
  // ENUM for now: pick one of `options`
  type: string
  options: string[]
  default: string
}

export type ReportInfo = {
  code: string
  title: string
  group: string
  module: string
  parameters: ReportParam[]
}

export type ColumnType = 'TEXT' | 'NUMBER' | 'MONEY' | 'PERCENT' | 'DATE' | 'DATETIME'

export type ReportColumn = { key: string; label: string; type: ColumnType }

export type ReportChart = {
  type: 'BAR' | 'LINE'
  // The row key the chart is plotted against, and the row keys it plots
  x: string
  y: string[]
}

export type ReportResult = {
  code: string
  title: string
  from: string
  to: string
  currency: string
  generatedAt: string
  columns: ReportColumn[]
  // Raw values: numbers stay numbers, the column's type says how to show them
  rows: Record<string, unknown>[]
  totals: Record<string, unknown>
  chart: ReportChart | null
  page: number
  totalPages: number
  totalElements: number
}

export type ReportQuery = {
  code: string
  // yyyy-MM-dd, at most 366 days apart
  from: string
  to: string
  // Branch uuid; empty = every branch the caller can see
  branch?: string
  page?: number
  size?: number
  // The report's own parameters, e.g. groupBy
  params?: Record<string, string>
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

type RawReport = Partial<Omit<ReportResult, 'chart'>> & {
  chart?: { type?: string; x?: string; y?: string[] | string } | null
}

const FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf']

const searchParams = ({ from, to, branch, params }: ReportQuery, extra: Record<string, string | number> = {}) => {
  const query = new URLSearchParams({ from, to })
  if (branch) query.set('branch', branch)
  for (const [key, value] of Object.entries(params ?? {})) if (value) query.set(key, value)
  for (const [key, value] of Object.entries(extra)) query.set(key, String(value))
  return query
}

export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // The reports the caller may run
    getReportCatalog: build.query<ReportInfo[], void>({
      query: () => '/reports/catalog',
      transformResponse: (response: ApiResponse<Partial<ReportInfo>[] | null>) =>
        (response.content ?? []).flatMap((raw) =>
          raw?.code
            ? [
                {
                  code: raw.code,
                  title: raw.title ?? raw.code,
                  group: raw.group ?? 'Other',
                  module: raw.module ?? '',
                  parameters: (raw.parameters ?? []).map((param) => ({
                    key: param.key,
                    type: param.type ?? 'ENUM',
                    options: param.options ?? [],
                    default: param.default ?? param.options?.[0] ?? '',
                  })),
                },
              ]
            : [],
        ),
    }),
    // 400 for a range over 366 days or a bad parameter; 403 without REPORTS:VIEW
    runReport: build.query<ReportResult, ReportQuery>({
      query: (query) => ({
        url: `/reports/${encodeURIComponent(query.code)}`,
        params: Object.fromEntries(searchParams(query, { page: query.page ?? 0, size: query.size ?? 50 })),
      }),
      transformResponse: (response: ApiResponse<RawReport | null>): ReportResult => {
        const raw = response.content ?? {}
        const y = raw.chart?.y
        return {
          code: raw.code ?? '',
          title: raw.title ?? '',
          from: raw.from ?? '',
          to: raw.to ?? '',
          currency: raw.currency ?? 'XAF',
          generatedAt: raw.generatedAt ?? '',
          columns: raw.columns ?? [],
          rows: raw.rows ?? [],
          totals: raw.totals ?? {},
          chart: raw.chart?.x && y ? { type: raw.chart.type === 'LINE' ? 'LINE' : 'BAR', x: raw.chart.x, y: Array.isArray(y) ? y : [y] } : null,
          page: raw.page ?? 0,
          totalPages: raw.totalPages ?? 1,
          totalElements: raw.totalElements ?? raw.rows?.length ?? 0,
        }
      },
    }),
    // Downloads the whole result (not one page) as a file. Goes through the shared base
    // query, so it carries the session token and refreshes it on a 401 like every other call.
    // The file is saved here and never reaches the store (a Blob isn't serializable)
    exportReport: build.mutation<null, { query: ReportQuery; format: ExportFormat }>({
      async queryFn({ query, format }, _api, _extra, baseQuery) {
        if (!FORMATS.includes(format)) return { error: { status: 400, data: { message: 'format_not_supported' } } }
        const result = await baseQuery({
          url: `/reports/${encodeURIComponent(query.code)}/export`,
          params: Object.fromEntries(searchParams(query, { format })),
          responseHandler: (response) => response.blob(),
        })
        if (result.error) {
          // The error body was read as a Blob too; turn it back into the server's JSON
          const body = result.error.data
          const parsed = body instanceof Blob ? await body.text().then((text) => JSON.parse(text) as unknown).catch(() => null) : body
          return { error: { ...result.error, data: parsed } as typeof result.error }
        }
        saveFile(result.data as Blob, `${query.code}.${format}`)
        return { data: null }
      },
    }),
  }),
})

export const { useGetReportCatalogQuery, useRunReportQuery, useExportReportMutation } = reportsApi

// Why an export was refused, in words
const EXPORT_ERRORS: Record<string, string> = {
  too_many_exports: 'Too many exports. Wait a minute and try again.',
  format_not_supported: 'That format isn’t available.',
  permission_denied: 'You can’t export reports.',
  not_allowed: 'You can’t export reports.',
}

// An export's failure as a sentence for the person
export function exportFailure(error: unknown) {
  const { status, data } = (error ?? {}) as { status?: unknown; data?: { message?: string } | null }
  if (status === 'FETCH_ERROR') return 'Could not reach the server. Try again in a moment.'
  const message = data?.message
  return EXPORT_ERRORS[message ?? ''] ?? message ?? `The export failed (${String(status ?? 'unknown')}).`
}

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
