import useChannelStats from '../../hooks/useChannelStats'
import { ArrowRight, BarChart3, FileText, History, Moon, Pencil, Plus, SlidersHorizontal, Zap } from 'lucide-react'
import {
  CATEGORIES,
  CHART_COLOR,
} from '../../constants/notifications'
import type {
  AppNotification,
  AutomationRule,
  MessageTemplate,
  NotificationCategory,
  NotificationLogEntry,
  NotificationPreferences,
} from '../../types/notification'
import { formatDate } from '../../utils/customers'
import { describeRule, formatStamp, getCategory } from '../../utils/notifications'
import { fieldClass, iconButton, primaryButton, secondaryButton } from '../orders/styles'
import Badge from '../ui/Badge'
import Panel, { PanelEmpty } from '../ui/Panel'

const headClass = 'text-[10px] font-bold tracking-wider text-muted uppercase'

function Switch({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-brand' : 'bg-muted/40'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-slate-50 shadow transition-transform ${checked ? 'translate-x-4' : ''}`} aria-hidden="true" />
    </button>
  )
}

// ---------- Automation rules ----------

export function RulesPanel({
  rules,
  canManage,
  onToggle,
  onEdit,
  onCreate,
}: {
  rules: AutomationRule[]
  canManage: boolean
  onToggle: (rule: AutomationRule) => void
  onEdit: (id: string) => void
  onCreate: () => void
}) {
  const active = rules.filter((rule) => rule.active).length
  return (
    <Panel
      title="Automation Rules"
      subtitle={`${active} of ${rules.length} rules active. They describe what should be sent when something happens.`}
      icon={Zap}
      action={
        canManage && (
          <button type="button" onClick={onCreate} className={primaryButton}>
            <Plus className="size-4" aria-hidden="true" />
            New Rule
          </button>
        )
      }
    >
      {rules.length === 0 ? (
        <PanelEmpty>Automate repetitive customer and staff communications.</PanelEmpty>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {rules.map((rule) => (
            <li key={rule.id} className="flex min-w-0 gap-3 rounded-lg bg-field p-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink">
                  {rule.name}
                  <Badge tone={rule.active ? 'success' : 'neutral'}>{rule.active ? 'Active' : 'Off'}</Badge>
                  {rule.successRate !== null && <span className="font-normal text-muted tabular-nums">{rule.successRate}% delivered · {rule.runs.toLocaleString('en-US')} runs</span>}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink">
                  <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-muted ring-1 ring-line">WHEN</span>
                  {rule.trigger}
                  {rule.conditions.map(({ field, value }, index) => (
                    <span key={`${field}-${value}`} className="flex items-center gap-1.5">
                      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-muted ring-1 ring-line">{index === 0 ? 'IF' : rule.logic}</span>
                      {field} is {value}
                    </span>
                  ))}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink">
                  <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">THEN</span>
                  Send {rule.channels.join(' + ') || 'nothing'}
                  <ArrowRight className="size-3 text-muted" aria-hidden="true" />
                  <span className="font-semibold">{rule.audience}</span>
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Switch label={`${rule.name} rule active`} checked={rule.active} onChange={() => onToggle(rule)} />
                  <button type="button" aria-label={`Edit ${rule.name}`} title="Edit" onClick={() => onEdit(rule.id)} className={iconButton}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted">
        Rules are saved and listed here, but nothing triggers them yet: no messaging provider is connected. Example: {rules[0] ? describeRule(rules[0]) : '—'}
      </p>
    </Panel>
  )
}

// ---------- Templates ----------

export function TemplatesPanel({
  templates,
  canManage,
  onEdit,
  onCreate,
  onToggle,
}: {
  templates: MessageTemplate[]
  canManage: boolean
  onEdit: (id: string) => void
  onCreate: () => void
  onToggle: (template: MessageTemplate) => void
}) {
  return (
    <Panel
      title="Message Templates"
      subtitle="Reusable wording with variables such as {{customerName}}"
      icon={FileText}
      action={
        canManage && (
          <button type="button" onClick={onCreate} className={secondaryButton}>
            <Plus className="size-4 text-muted" aria-hidden="true" />
            New Template
          </button>
        )
      }
    >
      {templates.length === 0 ? (
        <PanelEmpty>No templates yet.</PanelEmpty>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className={headClass}>
              <tr>
                <th scope="col" className="py-2 pr-3">Template</th>
                <th scope="col" className="py-2 pr-3">Category</th>
                <th scope="col" className="py-2 pr-3">Channel</th>
                <th scope="col" className="py-2 pr-3">Language</th>
                <th scope="col" className="py-2 pr-3">Status</th>
                <th scope="col" className="py-2 pr-3">Updated</th>
                <th scope="col" className="py-2 pr-3 text-right">Uses</th>
                {canManage && <th scope="col" className="py-2 text-right"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {templates.map((template) => (
                <tr key={template.id}>
                  <th scope="row" className="py-2 pr-3 font-semibold text-ink">
                    {template.name}
                    <span className="block max-w-64 truncate text-[11px] font-normal text-muted">{template.body}</span>
                  </th>
                  <td className="py-2 pr-3 text-muted">{getCategory(template.category).label}</td>
                  <td className="py-2 pr-3">{template.channel}</td>
                  <td className="py-2 pr-3 text-muted">{template.language}</td>
                  <td className="py-2 pr-3"><Badge tone={template.active ? 'success' : 'neutral'}>{template.active ? 'Active' : 'Disabled'}</Badge></td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatDate(template.updatedAt)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{template.uses.toLocaleString('en-US')}</td>
                  {canManage && (
                    <td className="py-2 text-right whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        <button type="button" onClick={() => onEdit(template.id)} className={`${secondaryButton} h-7`}>Edit</button>
                        <button type="button" onClick={() => onToggle(template)} className={`${secondaryButton} h-7`}>{template.active ? 'Disable' : 'Enable'}</button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ---------- Analytics ----------

export function NotificationAnalytics({ notifications }: { notifications: AppNotification[] }) {
  const channelStats = useChannelStats().stats
  const topChannel = Math.max(...channelStats.map(({ sent }) => sent), 1)
  const types = CATEGORIES.map(({ value, label }) => ({ label, count: notifications.filter((item) => item.category === value).length }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count)
  const topType = Math.max(...types.map(({ count }) => count), 1)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Channel Performance" subtitle="Messages sent in the last 30 days, with the share delivered" icon={BarChart3}>
        <ul className="space-y-2">
          {[...channelStats].sort((a, b) => b.sent - a.sent).map((stats) => (
            <li key={stats.channel} className="grid grid-cols-[5rem_1fr_7.5rem] items-center gap-2 text-xs" title={`${stats.channel}: ${stats.sent} sent, ${stats.delivered} delivered, ${stats.failed} failed`}>
              <span className="text-muted">{stats.channel}</span>
              <span className="h-4 rounded-sm bg-field">
                <span className="block h-full rounded-r" style={{ width: `${(stats.sent / topChannel) * 100}%`, background: CHART_COLOR }} />
              </span>
              <span className="text-right whitespace-nowrap tabular-nums">
                <span className="font-bold text-ink">{stats.sent.toLocaleString('en-US')}</span>
                <span className="ml-1.5 text-muted">{stats.sent === 0 ? '—' : `${((stats.delivered / stats.sent) * 100).toFixed(1)}%`}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Notifications by Type" subtitle="What is generating alerts in the inbox right now">
        {types.length === 0 ? (
          <PanelEmpty>Nothing in the inbox.</PanelEmpty>
        ) : (
          <ul className="space-y-2">
            {types.map(({ label, count }) => (
              <li key={label} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-2 text-xs" title={`${label}: ${count}`}>
                <span className="truncate text-muted">{label}</span>
                <span className="h-4 rounded-sm bg-field">
                  <span className="block h-full rounded-r" style={{ width: `${(count / topType) * 100}%`, background: CHART_COLOR }} />
                </span>
                <span className="text-right font-bold text-ink tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

// ---------- Preferences ----------

export function PreferencesPanel({
  preferences,
  roleNames,
  canManage,
  onChange,
}: {
  // The roles the business has, one row each
  roleNames: string[]
  preferences: NotificationPreferences
  canManage: boolean
  onChange: (preferences: NotificationPreferences) => void
}) {
  const toggle = (role: string, category: NotificationCategory) => {
    const current = preferences.roles[role] ?? []
    onChange({
      ...preferences,
      roles: {
        ...preferences.roles,
        [role]: current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
      },
    })
  }
  const quiet = preferences.quietHours
  const setQuiet = (change: Partial<typeof quiet>) => onChange({ ...preferences, quietHours: { ...quiet, ...change } })
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <Panel title="Who Gets Which Alerts" subtitle="Tick the alert types each role receives" icon={SlidersHorizontal}>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className={headClass}>
                <tr>
                  <th scope="col" className="py-2 pr-3">Role</th>
                  {CATEGORIES.map(({ value, label }) => (
                    <th key={value} scope="col" className="px-1 py-2 text-center font-bold normal-case">{label.replace('Laundry ', '').replace('Pickup & ', '')}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {roleNames.map((role) => (
                  <tr key={role}>
                    <th scope="row" className="py-2 pr-3 font-semibold whitespace-nowrap text-ink">{role}</th>
                    {CATEGORIES.map(({ value, label }) => (
                      <td key={value} className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${role} receives ${label} alerts`}
                          checked={(preferences.roles[role] ?? []).includes(value)}
                          disabled={!canManage}
                          onChange={() => toggle(role, value)}
                          className="size-4 accent-brand disabled:opacity-60"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <Panel title="Quiet Hours" icon={Moon}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink">Hold non-critical notifications overnight</p>
            <Switch label="Quiet hours" checked={quiet.enabled} disabled={!canManage} onChange={(enabled) => setQuiet({ enabled })} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <input type="time" aria-label="Quiet hours start" value={quiet.from} disabled={!canManage || !quiet.enabled} onChange={(event) => setQuiet({ from: event.target.value })} className={`${fieldClass} w-28! disabled:opacity-60`} />
            to
            <input type="time" aria-label="Quiet hours end" value={quiet.to} disabled={!canManage || !quiet.enabled} onChange={(event) => setQuiet({ to: event.target.value })} className={`${fieldClass} w-28! disabled:opacity-60`} />
          </div>
          <p className="text-[11px] text-muted">
            Critical alerts, payment failures, security alerts and machine failures are always sent straight away.
          </p>
        </div>
      </Panel>
    </div>
  )
}

// ---------- Activity log ----------

export function ActivityLogPanel({ log }: { log: NotificationLogEntry[] }) {
  return (
    <Panel title="Activity Log" subtitle="Who changed or sent what" icon={History}>
      {log.length === 0 ? (
        <PanelEmpty>No activity recorded.</PanelEmpty>
      ) : (
        <div className="relative max-h-72 overflow-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className={`${headClass} sticky top-0 bg-white`}>
              <tr>
                <th scope="col" className="py-2 pr-3">When</th>
                <th scope="col" className="py-2 pr-3">User</th>
                <th scope="col" className="py-2 pr-3">Action</th>
                <th scope="col" className="py-2">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {log.map((entry, index) => (
                <tr key={`${entry.at}-${index}`}>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatStamp(entry.at)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{entry.user}</td>
                  <th scope="row" className="py-2 pr-3 font-semibold whitespace-nowrap text-ink">{entry.action}</th>
                  <td className="py-2 text-muted">{entry.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
