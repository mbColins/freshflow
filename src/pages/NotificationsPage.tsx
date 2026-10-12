import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Download, FileText, Plus, Zap } from 'lucide-react'
import {
  ComposeDialog,
  RuleDialog,
  TemplateDialog,
} from '../components/notifications/NotificationDialogs'
import {
  ChannelHealth,
  NotificationDrawer,
  NotificationInbox,
  NotificationKpis,
  NotificationTabs,
  NotificationToolbar,
} from '../components/notifications/NotificationsInbox'
import type { InboxActions } from '../components/notifications/NotificationsInbox'
import {
  ActivityLogPanel,
  NotificationAnalytics,
  PreferencesPanel,
  RulesPanel,
  TemplatesPanel,
} from '../components/notifications/NotificationsPanels'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, primaryButton, secondaryButton } from '../components/orders/styles'
import {
  DEFAULT_PREFERENCES,
  EMPTY_NOTIFICATION_FILTERS,
  NOTIFICATION_PERMISSIONS,
  RULE_RECIPIENTS,
  RULE_TRIGGERS,
} from '../constants/notifications'
import { CURRENT_USER, ORDER_ROLES } from '../constants/orders'
import useBranches from '../hooks/useBranches'
import useLocalStorage from '../hooks/useLocalStorage'
import useNotifications, { notificationStore } from '../hooks/useNotifications'
import useNow from '../hooks/useNow'
import type {
  AutomationRule,
  ComposeInput,
  MessageTemplate,
  NotificationFilters,
  NotificationPreferences,
} from '../types/notification'
import type { OrderRole } from '../types/order'
import {
  compareNotifications,
  composeNotification,
  matchesNotificationFilters,
  notificationsToCsv,
} from '../utils/notifications'
import { downloadFile } from '../utils/orders'

const TOAST_MS = 4000

type DialogState =
  | { name: 'compose' }
  // An empty id starts a new rule or template
  | { name: 'rule' | 'template'; id: string }

const EMPTY_MESSAGES: Partial<Record<NotificationFilters['tab'], string>> = {
  unread: 'You’re all caught up.',
  critical: 'No critical alerts are open.',
  failed: 'All notifications were delivered successfully.',
  scheduled: 'There are no notifications scheduled.',
}

function NotificationsPage() {
  const now = useNow()
  const branches = useBranches()
  const { notifications: all, rules, templates, log } = useNotifications()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<NotificationFilters>(EMPTY_NOTIFICATION_FILTERS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [role, setRole] = useLocalStorage<OrderRole>('notifications.role', 'admin')
  const [preferences, setPreferences] = useLocalStorage<NotificationPreferences>('notifications.preferences', DEFAULT_PREFERENCES)
  const searchRef = useRef<HTMLInputElement>(null)
  const rulesRef = useRef<HTMLDivElement>(null)
  const templatesRef = useRef<HTMLDivElement>(null)

  const permissions = NOTIFICATION_PERMISSIONS[role]
  const branchOptions = branches.map(({ id, name }) => ({ id, name }))
  const branchName = (id: string) => branches.find((branch) => branch.id === id)?.name ?? id
  // What this role is allowed to see, minus anything archived
  const visible = all.filter((item) => !item.archived && (permissions.categories === null || permissions.categories.includes(item.category)))
  // Everything except the tab, so the tab counts stay put while searching
  const scoped = visible.filter((item) => matchesNotificationFilters(item, { ...filters, tab: 'all' }, now))
  const filtered = scoped.filter((item) => matchesNotificationFilters(item, filters, now)).sort(compareNotifications)
  const filtersActive = (Object.keys(filters) as (keyof NotificationFilters)[]).some((key) => key !== 'tab' && filters[key] !== '')
  const openId = searchParams.get('open')
  const openNotification = visible.find(({ id }) => id === openId) ?? null
  const editingRule = dialog?.name === 'rule' ? rules.find(({ id }) => id === dialog.id) : undefined
  const editingTemplate = dialog?.name === 'template' ? templates.find(({ id }) => id === dialog.id) : undefined

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

  const patchFilters = (patch: Partial<NotificationFilters>) => {
    setFilters({ ...filters, ...patch })
    setSelectedIds([])
  }
  const plural = (count: number) => `${count} ${count === 1 ? 'notification' : 'notifications'}`
  const setOpen = (id: string | null) => setSearchParams(id ? { open: id } : {}, { replace: true })

  function handleOpen(id: string) {
    notificationStore.update([id], (item) => (item.read || item.delivery === 'scheduled' ? item : { ...item, read: true, readAt: new Date().toISOString() }))
    setOpen(id)
  }

  const actions: InboxActions = {
    now,
    branchName,
    onOpen: handleOpen,
    onRead: (ids, read) => {
      const at = new Date().toISOString()
      notificationStore.update(ids, (item) => ({ ...item, read, readAt: read ? (item.readAt ?? at) : null }))
      setToast(`${plural(ids.length)} marked ${read ? 'read' : 'unread'}`)
    },
    onResolve: (ids) => {
      const at = new Date().toISOString()
      notificationStore.update(ids, (item) => ({ ...item, resolved: true, read: true, readAt: item.readAt ?? at }), ['Notification resolved', plural(ids.length)])
      setSelectedIds([])
      setToast(`${plural(ids.length)} resolved`)
    },
    onArchive: (ids) =>
      setConfirm({
        title: `Archive ${plural(ids.length)}?`,
        body: 'Archived notifications leave the inbox and its counts. They stay in the activity log.',
        confirmLabel: 'Archive',
        destructive: true,
        onConfirm: () => {
          notificationStore.update(ids, (item) => ({ ...item, archived: true }), ['Notification archived', plural(ids.length)])
          setSelectedIds([])
          if (openId && ids.includes(openId)) setOpen(null)
          setToast(`${plural(ids.length)} archived`)
        },
      }),
    onRetry: (ids) => {
      notificationStore.update(
        ids,
        (item) => (item.failure ? { ...item, failure: { ...item.failure, attempts: item.failure.attempts + 1, lastAttemptAt: new Date().toISOString() } } : item),
        ['Notification retried', plural(ids.length)],
      )
      setToast(`Retry recorded for ${plural(ids.length)}. No provider is connected, so the status stays Failed`)
    },
    onSendNow: (id) => {
      const at = new Date().toISOString()
      const item = all.find((notification) => notification.id === id)!
      notificationStore.update([id], (current) => ({ ...current, delivery: 'delivered', scheduledFor: null, createdAt: at, readAt: at }), ['Notification sent', item.title])
      setToast(`“${item.title}” sent now`)
    },
    onCancel: (id) => {
      const item = all.find((notification) => notification.id === id)!
      setConfirm({
        title: `Cancel “${item.title}”?`,
        body: `The scheduled notification to ${item.recipient} will not be sent.`,
        confirmLabel: 'Cancel notification',
        destructive: true,
        onConfirm: () => {
          notificationStore.update([id], (current) => ({ ...current, archived: true }), ['Scheduled notification cancelled', item.title])
          setToast('Scheduled notification cancelled')
        },
      })
    },
  }

  function handleSend(input: ComposeInput) {
    const id = `NTF-${84_921 + all.length}`
    notificationStore.add(composeNotification(input, id, CURRENT_USER), [input.scheduledFor ? 'Notification scheduled' : 'Notification sent', `${input.title} → ${input.audience}`])
    setDialog(null)
    patchFilters({ tab: input.scheduledFor ? 'scheduled' : 'all' })
    setToast(input.scheduledFor ? 'Notification scheduled' : 'Notification recorded as sent')
  }

  function handleSaveRule(rule: AutomationRule) {
    notificationStore.saveRule(rule, [editingRule ? 'Rule edited' : 'Rule created', `${rule.name} (${rule.active ? 'active' : 'off'})`])
    setDialog(null)
    setToast(`Rule “${rule.name}” saved`)
  }

  function handleSaveTemplate(template: MessageTemplate) {
    notificationStore.saveTemplate(template, [editingTemplate ? 'Template modified' : 'Template created', `${template.name} (${template.channel})`])
    setDialog(null)
    setToast(`Template “${template.name}” saved`)
  }

  const blankRule: AutomationRule = { id: `RULE-${String(rules.length + 1).padStart(2, '0')}`, name: '', trigger: RULE_TRIGGERS[0], conditions: [], logic: 'AND', channels: ['SMS'], audience: RULE_RECIPIENTS[0], active: false, successRate: null, runs: 0 }
  const blankTemplate: MessageTemplate = { id: `TPL-${String(templates.length + 1).padStart(2, '0')}`, name: '', category: 'orders', channel: 'SMS', language: 'English', active: true, updatedAt: '', uses: 0, subject: '', body: '' }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">Notifications</h1>
            <p className="text-xs text-muted">
              Monitor alerts, customer messages, system events, and business communications.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => rulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={secondaryButton}>
              <Zap className="size-4 text-muted" aria-hidden="true" />
              Automations
            </button>
            <button type="button" onClick={() => templatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={secondaryButton}>
              <FileText className="size-4 text-muted" aria-hidden="true" />
              Templates
            </button>
            <button
              type="button"
              onClick={() => {
                downloadFile('notifications.csv', notificationsToCsv(filtered), 'text/csv;charset=utf-8')
                setToast(`Exported ${plural(filtered.length)}`)
              }}
              className={secondaryButton}
            >
              <Download className="size-4 text-muted" aria-hidden="true" />
              Export
            </button>
            {permissions.manage && (
              <button type="button" onClick={() => setDialog({ name: 'compose' })} className={`${primaryButton} max-md:hidden`}>
                <Plus className="size-4" aria-hidden="true" />
                Create Notification
              </button>
            )}
          </div>
        </div>
        <label className="flex w-fit items-center gap-2 text-[11px] whitespace-nowrap text-muted">
          Viewing as
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as OrderRole)
              setSelectedIds([])
            }}
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

      <NotificationKpis notifications={visible} selected={filters.tab} onTab={(tab) => patchFilters({ tab })} />

      {permissions.manage && <ChannelHealth />}

      <NotificationTabs notifications={scoped} selected={filters.tab} onSelect={(tab) => patchFilters({ tab })} />

      <section className="rounded-xl bg-white p-3 ring-1 ring-line">
        <NotificationToolbar
          searchRef={searchRef}
          filters={filters}
          branches={branchOptions}
          filtersActive={filtersActive}
          onChange={patchFilters}
          onReset={() => patchFilters({ ...EMPTY_NOTIFICATION_FILTERS, tab: filters.tab })}
        />
      </section>

      <NotificationInbox
        notifications={filtered}
        selectedIds={selectedIds}
        emptyMessage={filtersActive ? 'No notifications match these filters.' : (EMPTY_MESSAGES[filters.tab] ?? 'Nothing here yet.')}
        onSelect={setSelectedIds}
        {...actions}
      />

      {permissions.manage && (
        <>
          <div ref={rulesRef} className="scroll-mt-20">
            <RulesPanel
              rules={rules}
              canManage
              onToggle={(rule) => {
                notificationStore.saveRule({ ...rule, active: !rule.active }, [rule.active ? 'Rule disabled' : 'Rule activated', rule.name])
                setToast(`Rule “${rule.name}” ${rule.active ? 'turned off' : 'activated'}`)
              }}
              onEdit={(id) => setDialog({ name: 'rule', id })}
              onCreate={() => setDialog({ name: 'rule', id: '' })}
            />
          </div>

          <div ref={templatesRef} className="scroll-mt-20">
            <TemplatesPanel
              templates={templates}
              canManage
              onEdit={(id) => setDialog({ name: 'template', id })}
              onCreate={() => setDialog({ name: 'template', id: '' })}
              onToggle={(template) => {
                notificationStore.saveTemplate({ ...template, active: !template.active }, [template.active ? 'Template disabled' : 'Template enabled', template.name])
                setToast(`Template “${template.name}” ${template.active ? 'disabled' : 'enabled'}`)
              }}
            />
          </div>

          <NotificationAnalytics notifications={visible} />

          <PreferencesPanel
            preferences={preferences}
            canManage
            onChange={(next) => {
              setPreferences(next)
              notificationStore.log('Preference changed', 'Alert types by role or quiet hours')
            }}
          />

          <ActivityLogPanel log={log} />
        </>
      )}

      {permissions.manage && (
        <button
          type="button"
          onClick={() => setDialog({ name: 'compose' })}
          className={`${primaryButton} fixed right-4 bottom-4 z-20 h-12 rounded-full px-5 shadow-lg md:hidden`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Create
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

      <NotificationDrawer notification={openNotification} onClose={() => setOpen(null)} {...actions} />
      {dialog?.name === 'compose' && (
        <ComposeDialog branches={branchOptions} now={now} onClose={() => setDialog(null)} onSend={handleSend} />
      )}
      {dialog?.name === 'rule' && (
        <RuleDialog rule={editingRule ?? blankRule} onClose={() => setDialog(null)} onSave={handleSaveRule} />
      )}
      {dialog?.name === 'template' && (
        <TemplateDialog template={editingTemplate ?? blankTemplate} onClose={() => setDialog(null)} onSave={handleSaveTemplate} />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}

export default NotificationsPage
