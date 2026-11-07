import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, ChartColumn } from 'lucide-react'
import { fieldClass, labelClass, secondaryButton } from '../components/orders/styles'
import ReportChart from '../components/reports/ReportChart'
import Panel from '../components/ui/Panel'
import StatTile from '../components/ui/StatTile'
import useCurrentUser from '../hooks/useCurrentUser'
import { useGetBranchDropdownQuery } from '../services/branchApi'
import { exportFailure, useExportReportMutation, useGetReportCatalogQuery, useRunReportQuery } from '../services/reportsApi'
import type { ExportFormat, ReportInfo, ReportQuery } from '../services/reportsApi'
import { NETWORK_ERROR_MESSAGE, errorMessage, serverMessage } from '../utils/apiErrors'
import { daysBetween, formatReportValue, humanize, isNumeric, isoDay, totalType } from '../utils/reports'

const PAGE_SIZE = 25
const MAX_RANGE_DAYS = 366
const TOAST_MS = 5000

const failure = (error: unknown) =>
  serverMessage(error) ?? errorMessage(error as Parameters<typeof errorMessage>[0], 'The server refused the request.') ?? NETWORK_ERROR_MESSAGE

const daysAgo = (days: number) => isoDay(new Date(Date.now() - days * 86_400_000))

const EXPORTS: { format: ExportFormat; label: string; icon: typeof Download }[] = [
  { format: 'csv', label: 'CSV', icon: Download },
  { format: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { format: 'pdf', label: 'PDF', icon: FileText },
]

// A total can be a number or a small object (e.g. band totals): show the
// object's entries as separate figures
function flattenTotals(totals: Record<string, unknown>) {
  return Object.entries(totals).flatMap(([key, value]): [string, unknown][] =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value as Record<string, unknown>).map(([inner, innerValue]): [string, unknown] => [`${key}.${inner}`, innerValue])
      : [[key, value]],
  )
}

function ReportsPage() {
  const { can } = useCurrentUser()
  const catalogQuery = useGetReportCatalogQuery()
  const { data: branches = [] } = useGetBranchDropdownQuery()
  const catalog = catalogQuery.data
  // The report the person picked; until they pick one, the first in the catalog
  const [chosen, setChosen] = useState('')
  const [from, setFrom] = useState(() => daysAgo(30))
  const [to, setTo] = useState(() => daysAgo(0))
  const [branch, setBranch] = useState('')
  // Changes to the report's own options; what isn't changed keeps its default
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const groups = useMemo(() => {
    const byGroup = new Map<string, ReportInfo[]>()
    for (const report of catalog ?? []) byGroup.set(report.group, [...(byGroup.get(report.group) ?? []), report])
    return [...byGroup.entries()]
  }, [catalog])
  const selected = catalog?.find((report) => report.code === chosen) ?? catalog?.[0]
  const code = selected?.code ?? ''
  const params: Record<string, string> = {
    ...Object.fromEntries((selected?.parameters ?? []).map(({ key, default: value }) => [key, value])),
    ...overrides,
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const rangeDays = from && to ? daysBetween(from, to) : -1
  const rangeProblem =
    !from || !to ? 'Choose both dates.' : rangeDays < 0 ? 'The end date is before the start date.' : rangeDays > MAX_RANGE_DAYS ? `Choose at most ${MAX_RANGE_DAYS} days.` : null

  const query: ReportQuery = { code, from, to, branch, params }
  const result = useRunReportQuery({ ...query, page, size: PAGE_SIZE }, { skip: !code || rangeProblem !== null })
  // currentData, not data: while another report or filter loads, `data` is still the
  // previous one, which would sit under the new title and hide a failed run
  const data = result.currentData
  const [exportReport] = useExportReportMutation()

  // A filter that shrinks the result can leave the saved page past its end: step back
  // to the last page (adjusting state while rendering, as React documents for this)
  if (data && page > 0 && page >= data.totalPages) setPage(Math.max(0, data.totalPages - 1))

  function pick(report: ReportInfo) {
    setChosen(report.code)
    setOverrides({})
    setPage(0)
  }

  async function handleExport(format: ExportFormat) {
    setExporting(format)
    try {
      await exportReport({ query, format }).unwrap()
      setToast(`${selected?.title ?? 'Report'} exported as ${format.toUpperCase()}`)
    } catch (caught) {
      setToast(exportFailure(caught))
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Reports</h1>
          <p className="text-xs text-muted">Sales, payments, stock, people and operations. Run a report for any period and export it.</p>
        </div>

        {catalogQuery.isLoading ? (
          <p role="status" className="rounded-xl bg-white px-4 py-10 text-center text-xs text-muted ring-1 ring-line">
            Loading the reports…
          </p>
        ) : catalogQuery.isError && !catalog ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-12 text-center ring-1 ring-line">
            <h2 className="text-sm font-bold text-ink">Couldn’t load the reports</h2>
            <p className="max-w-md text-xs text-muted">{failure(catalogQuery.error)} Only the owner and managers, or roles with Reports access, can open this page.</p>
            <button type="button" onClick={() => void catalogQuery.refetch()} disabled={catalogQuery.isFetching} className={`${secondaryButton} mt-1`}>
              {catalogQuery.isFetching ? 'Retrying…' : 'Try again'}
            </button>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <nav aria-label="Reports" className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-line lg:sticky lg:top-20">
              {groups.map(([group, reports]) => (
                <div key={group}>
                  <p className="px-2 pb-1 text-[10px] font-bold tracking-wider text-muted uppercase">{group}</p>
                  <ul className="space-y-0.5">
                    {reports.map((report) => (
                      <li key={report.code}>
                        <button
                          type="button"
                          aria-current={report.code === code ? 'page' : undefined}
                          onClick={() => pick(report)}
                          className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                            report.code === code ? 'bg-brand text-white' : 'text-ink hover:bg-field'
                          }`}
                        >
                          {report.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="min-w-0 space-y-4">
              <Panel
                title={selected?.title ?? 'Report'}
                icon={ChartColumn}
                action={
                  can('REPORTS:EXPORT') && (
                    <div className="flex flex-wrap gap-2">
                      {EXPORTS.map(({ format, label, icon: Icon }) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => void handleExport(format)}
                          disabled={!code || rangeProblem !== null || exporting !== null}
                          className={`${secondaryButton} h-8`}
                        >
                          <Icon className="size-3.5 text-muted" aria-hidden="true" />
                          {exporting === format ? 'Exporting…' : label}
                        </button>
                      ))}
                    </div>
                  )
                }
              >
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="report-from" className={labelClass}>
                      From
                    </label>
                    <input
                      id="report-from"
                      type="date"
                      value={from}
                      max={to || undefined}
                      onChange={(event) => {
                        setFrom(event.target.value)
                        setPage(0)
                      }}
                      className={`${fieldClass} w-40`}
                    />
                  </div>
                  <div>
                    <label htmlFor="report-to" className={labelClass}>
                      To
                    </label>
                    <input
                      id="report-to"
                      type="date"
                      value={to}
                      min={from || undefined}
                      onChange={(event) => {
                        setTo(event.target.value)
                        setPage(0)
                      }}
                      className={`${fieldClass} w-40`}
                    />
                  </div>
                  <div className="flex gap-1.5 pb-0.5">
                    {[
                      ['7 days', 7],
                      ['30 days', 30],
                      ['90 days', 90],
                      ['1 year', 365],
                    ].map(([label, days]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setFrom(daysAgo(Number(days)))
                          setTo(daysAgo(0))
                          setPage(0)
                        }}
                        className="h-7 rounded-md bg-field px-2.5 text-[11px] font-semibold text-ink transition hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {branches.length > 1 && (
                    <div>
                      <label htmlFor="report-branch" className={labelClass}>
                        Branch
                      </label>
                      <select
                        id="report-branch"
                        value={branch}
                        onChange={(event) => {
                          setBranch(event.target.value)
                          setPage(0)
                        }}
                        className={`${fieldClass} w-44`}
                      >
                        <option value="">All branches</option>
                        {branches.map(({ uuid, name }) => (
                          <option key={uuid} value={uuid}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selected?.parameters.map((param) => (
                    <div key={param.key}>
                      <label htmlFor={`report-${param.key}`} className={labelClass}>
                        {humanize(param.key)}
                      </label>
                      <select
                        id={`report-${param.key}`}
                        value={params[param.key] ?? param.default}
                        onChange={(event) => {
                          setOverrides({ ...overrides, [param.key]: event.target.value })
                          setPage(0)
                        }}
                        className={`${fieldClass} w-40`}
                      >
                        {param.options.map((option) => (
                          <option key={option} value={option}>
                            {humanize(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {rangeProblem && <p className="mt-2 text-[11px] font-semibold text-danger">{rangeProblem}</p>}
              </Panel>

              {result.isLoading || (result.isFetching && !data) ? (
                <p role="status" className="rounded-xl bg-white px-4 py-10 text-center text-xs text-muted ring-1 ring-line">
                  Running the report…
                </p>
              ) : result.isError && !data ? (
                <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-10 text-center ring-1 ring-line">
                  <h2 className="text-sm font-bold text-ink">The report couldn’t run</h2>
                  <p className="max-w-md text-xs text-muted">{failure(result.error)}</p>
                  <button type="button" onClick={() => void result.refetch()} disabled={result.isFetching} className={`${secondaryButton} mt-1`}>
                    {result.isFetching ? 'Retrying…' : 'Try again'}
                  </button>
                </div>
              ) : data ? (
                <div className={`space-y-4 transition-opacity ${result.isFetching ? 'opacity-60' : ''}`}>
                  <p className="text-[11px] text-muted">
                    {formatReportValue(data.from, 'DATE', data.currency)} to {formatReportValue(data.to, 'DATE', data.currency)} · {data.totalElements}{' '}
                    {data.totalElements === 1 ? 'row' : 'rows'} · generated {formatReportValue(data.generatedAt, 'DATETIME', data.currency)}
                  </p>

                  {Object.keys(data.totals).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                      {flattenTotals(data.totals).map(([key, value]) => (
                        <StatTile
                          key={key}
                          label={humanize(key.replace('.', ' '))}
                          value={formatReportValue(value, totalType(key.split('.')[0], data.columns), data.currency)}
                        />
                      ))}
                    </div>
                  )}

                  {data.chart && data.rows.length > 0 && (
                    <Panel title="Chart">
                      <ReportChart chart={data.chart} rows={data.rows} columns={data.columns} currency={data.currency} />
                    </Panel>
                  )}

                  <section className="min-w-0 rounded-xl bg-white ring-1 ring-line">
                    {data.rows.length === 0 ? (
                      <p className="px-4 py-12 text-center text-xs text-muted">Nothing to report for this period.</p>
                    ) : (
                      <div className="relative overflow-x-auto">
                        <table className="w-full min-w-[560px] text-xs">
                          <thead>
                            <tr>
                              {data.columns.map((column) => (
                                <th
                                  key={column.key}
                                  scope="col"
                                  className={`sticky top-0 bg-white px-3 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--color-line)] ${
                                    isNumeric(column.type) ? 'text-right' : 'text-left'
                                  }`}
                                >
                                  {column.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.rows.map((row, index) => (
                              <tr key={index} className="border-t border-line">
                                {data.columns.map((column) => (
                                  <td
                                    key={column.key}
                                    className={`px-3 py-2 ${isNumeric(column.type) ? 'text-right whitespace-nowrap tabular-nums' : 'text-left'}`}
                                  >
                                    {formatReportValue(row[column.key], column.type, data.currency)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {data.totalPages > 1 && (
                      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-[11px] text-muted">
                        <span>
                          Page {data.page + 1} of {data.totalPages}
                        </span>
                        <span className="flex gap-1.5">
                          <button
                            type="button"
                            aria-label="Previous page"
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                            className={`${secondaryButton} h-7 w-8 shrink-0 px-0`}
                          >
                            <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Next page"
                            disabled={page + 1 >= data.totalPages}
                            onClick={() => setPage(page + 1)}
                            className={`${secondaryButton} h-7 w-8 shrink-0 px-0`}
                          >
                            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                    )}
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </p>
      )}
    </>
  )
}

export default ReportsPage
