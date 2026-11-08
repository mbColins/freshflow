import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Download, FileText, Plus, RotateCcw, Zap } from 'lucide-react'
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
import { primaryButton, secondaryButton } from '../components/orders/styles'
import {
  DEFAULT_PREFERENCES,
  EMPTY_NOTIFICATION_FILTERS,
  RULE_RECIPIENTS,
  SKIP_REASONS,
  RULE_TRIGGERS,
} from '../constants/notifications'
import { useGetBranchDropdownQuery } from '../services/branchApi'
import useCurrentUser from '../hooks/useCurrentUser'
import useNotifications, { notificationStore } from '../hooks/useNotifications'
import useNow from '../hooks/useNow'
import useSendInApp from '../hooks/useSendInApp'
import { useListAuditQuery } from '../services/auditApi'
import {
  CHANNEL_TO_SERVER,
  useBulkUpdateCenterMutation,
  useCancelMessageMutation,
  useComposeMessageMutation,
  useGetNotificationPreferencesQuery,
  useListCenterQuery,
  useRetryMessageMutation,
  useSetNotificationPreferencesMutation,
  useUpdateCenterItemMutation,
} from '../services/notificationCenterApi'
import { useCreateMessageTemplateMutation, useListMessageTemplatesQuery, useUpdateMessageTemplateMutation } from '../services/messageTemplateApi'
import { useListRolesQuery } from '../services/roleApi'
import type {
  AppNotification,
  AutomationRule,
  ComposeInput,
  MessageTemplate,
  NotificationFilters,
  NotificationLogEntry,
  NotificationPreferences,
} from '../types/notification'
import { describeError } from '../utils/apiReasons'
import {
  compareNotifications,
  matchesNotificationFilters,
  notificationsToCsv,
} from '../utils/notifications'
import { downloadFile } from '../utils/orders'

const TOAST_MS = 5000
// TODO: page through the inbox if it ever holds more than this
const INBOX = { tab: 'ALL', page: 0, size: 200 }
const MESSAGE_LOG = { entityType: 'MESSAGE' as const, page: 0, size: 30 }
const ROLES = { page: 0, size: 100 }
const NO_NOTIFICATIONS: AppNotification[] = []
const NO_TEMPLATES: MessageTemplate[] = []

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
  // GET /branch/dropdown: every branch the connected user can see, not a capped page of them
  const branchList = useGetBranchDropdownQuery()
  const { can, name: actor, user } = useCurrentUser()
  const inboxQuery = useListCenterQuery(INBOX)
  const all = inboxQuery.data ?? NO_NOTIFICATIONS
  const { rules, log: localLog } = useNotifications()
  const { data: messageAudit } = useListAuditQuery(MESSAGE_LOG)
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<NotificationFilters>(EMPTY_NOTIFICATION_FILTERS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const rulesRef = useRef<HTMLDivElement>(null)
  const templatesRef = useRef<HTMLDivElement>(null)

  const [updateItem] = useUpdateCenterItemMutation()
  const [bulkUpdate] = useBulkUpdateCenterMutation()
  const [retryMessage] = useRetryMessageMutation()
  const [cancelMessage] = useCancelMessageMutation()
  const [composeMessage] = useComposeMessageMutation()
  const sendInApp = useSendInApp()

  // Sending needs NOTIFICATIONS:SEND; reading what the centre shows is up to the server
  const canManage = can('NOTIFICATIONS:SEND')
  // Preferences are for owners and managers; for anyone else the request is refused and the defaults stay
  const { data: serverPreferences } = useGetNotificationPreferencesQuery(undefined, { skip: !canManage })
  const preferences = serverPreferences ?? DEFAULT_PREFERENCES
  const [savePreferences] = useSetNotificationPreferencesMutation()
  const { data: roleList } = useListRolesQuery(ROLES, { skip: !canManage })

  // Message templates are the business's own, kept on the server. The panel is only drawn for
  // people who can send, so only they fetch the list; changing one needs its own permission
  const canEditTemplates = can('NOTIFICATIONS:MANAGE_TEMPLATES')
  const templateList = useListMessageTemplatesQuery(undefined, { skip: !canManage })
  const templates = templateList.data ?? NO_TEMPLATES
  const [createTemplate] = useCreateMessageTemplateMutation()
  const [updateTemplate] = useUpdateMessageTemplateMutation()
  const roleNames = useMemo(
    () => [...new Set([...(roleList?.items ?? []).map(({ name }) => name), ...Object.keys(preferences.roles)])].sort(),
    [roleList, preferences.roles],
  )

  // Messages sent or changed through the centre, newest first, with the rule and template edits made here
  const log = useMemo<NotificationLogEntry[]>(
    () =>
      [
        ...(messageAudit?.items ?? []).map((entry) => ({
          at: entry.at,
          user: entry.actor || 'System',
          action: entry.action.toLowerCase().replace(/_/g, ' '),
          entity: entry.summary,
        })),
        ...localLog,
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [messageAudit, localLog],
  )

  // Notifications and branches refer to a branch by the API's uuid
  const branchOptions = useMemo(() => (branchList.data ?? []).map(({ uuid, name }) => ({ id: uuid, name })), [branchList.data])
  const branchName = (id: string) => branchOptions.find((branch) => branch.id === id)?.name ?? id
  // The server hides archived rows and scopes the rest
  const visible = all
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
  const fail = (error: unknown, fallback: string) => setToast(describeError(error, fallback))

  function handleOpen(id: string) {
    const item = all.find((notification) => notification.id === id)
    // Opening reads it; a scheduled message hasn't gone out, so there is nothing to read
    if (item && !item.read && item.delivery !== 'scheduled') void updateItem({ id, read: true })
    setOpen(id)
  }

  const actions: InboxActions = {
    now,
    branchName,
    onOpen: handleOpen,
    onRead: (ids, read) => {
      bulkUpdate({ ids, read })
        .unwrap()
        .then(() => setToast(`${plural(ids.length)} marked ${read ? 'read' : 'unread'}`))
        .catch((error) => fail(error, 'The change wasn’t saved.'))
    },
    onResolve: (ids) => {
      bulkUpdate({ ids, resolved: true, read: true })
        .unwrap()
        .then(() => {
          setSelectedIds([])
          setToast(`${plural(ids.length)} resolved`)
        })
        .catch((error) => fail(error, 'The change wasn’t saved.'))
    },
    onArchive: (ids) =>
      setConfirm({
        title: `Archive ${plural(ids.length)}?`,
        body: 'Archived notifications leave the inbox and its counts. They stay in the activity log.',
        confirmLabel: 'Archive',
        destructive: true,
        onConfirm: () => {
          bulkUpdate({ ids, archived: true })
            .unwrap()
            .then(() => {
              setSelectedIds([])
              if (openId && ids.includes(openId)) setOpen(null)
              setToast(`${plural(ids.length)} archived`)
            })
            .catch((error) => fail(error, 'The change wasn’t saved.'))
        },
      }),
    // A failed message is tried again at once; whether it goes depends on the channel having a sender
    onRetry: (ids) => {
      void Promise.allSettled(ids.map((id) => retryMessage(id).unwrap())).then((results) => {
        const failed = results.filter((result) => result.status === 'rejected')
        setToast(
          failed.length === 0
            ? `Retry sent for ${plural(ids.length)}`
            : `${failed.length} of ${ids.length} couldn’t be retried. ${describeError((failed[0] as PromiseRejectedResult).reason, 'The server refused.')}`,
        )
      })
    },
    // The server can't send a scheduled message early; it can be cancelled and composed again
    onSendNow: () => setToast('A scheduled message goes out at its time. To send now, cancel it and create it again.'),
    onCancel: (id) => {
      const item = all.find((notification) => notification.id === id)
      if (!item) return
      setConfirm({
        title: `Cancel “${item.title}”?`,
        body: `The scheduled notification to ${item.recipient} will not be sent.`,
        confirmLabel: 'Cancel notification',
        destructive: true,
        onConfirm: () => {
          cancelMessage(id)
            .unwrap()
            .then(() => setToast('Scheduled notification cancelled'))
            .catch((error) => fail(error, 'The notification couldn’t be cancelled.'))
        },
      })
    },
  }

  async function handleSend(input: ComposeInput) {
    // In-App goes through POST /notifications, which inserts the bell notifications now. It can't
    // hold a message for later, so a scheduled one still goes through the notification centre
    const directInApp = input.channels.includes('In-App') && !input.scheduledFor
    let centreChannels = directInApp ? input.channels.filter((channel) => channel !== 'In-App') : input.channels
    const done: string[] = []
    try {
      if (directInApp) {
        try {
          const sent = await sendInApp(input)
          done.push(
            sent.created === 0
              ? 'No staff matched, so no in-app notification was created'
              : `In-app: ${sent.created} ${sent.created === 1 ? 'person' : 'people'} notified${sent.failed > 0 ? ` (${sent.failed} failed)` : ''}`,
          )
        } catch (error) {
          // 403: someone is outside what this user may reach through that endpoint (a manager writing to the
          // owner, say). The centre applies its own audience rules, so let it send the In-App part
          if ((error as { status?: number }).status !== 403) throw error
          centreChannels = input.channels
        }
      }
      if (centreChannels.length > 0) {
        const result = await composeMessage({
          audience: input.audience,
          channels: centreChannels.map((channel) => CHANNEL_TO_SERVER[channel]),
          title: input.title,
          message: input.message,
          ...(input.branchId ? { branch: input.branchId } : {}),
          ...(input.scheduledFor ? { scheduledFor: `${input.scheduledFor.slice(0, 16)}:00` } : {}),
          category: input.audience === 'CUSTOMERS' ? 'CUSTOMERS' : 'STAFF',
        }).unwrap()
        const skipped = result.skipped.reduce((sum, { count }) => sum + count, 0)
        const why = result.skipped.map(({ reason, count }) => `${count} ${SKIP_REASONS[reason] ?? reason}`).join('; ')
        patchFilters({ tab: result.scheduled ? 'scheduled' : 'all' })
        done.push(
          result.recipients === 0
            ? `Nothing was sent${skipped > 0 ? `: ${why}` : '. No one matches this audience.'}`
            : `${result.scheduled ? 'Scheduled for' : 'Sent to'} ${result.recipients} ${result.recipients === 1 ? 'recipient' : 'recipients'}${skipped > 0 ? `; skipped: ${why}` : ''}`,
        )
      }
      setDialog(null)
      setToast(done.join(' · '))
    } catch (error) {
      const reason = describeError(error, 'The notification wasn’t sent.')
      if (done.length > 0) {
        // Part of it went out, so don't leave the form open to send that part twice
        setDialog(null)
        setToast(`${done.join(' · ')}. The rest wasn’t sent: ${reason}`)
      } else {
        setToast(reason)
      }
    }
  }

  function handleSaveRule(rule: AutomationRule) {
    notificationStore.saveRule(rule, [editingRule ? 'Rule edited' : 'Rule created', `${rule.name} (${rule.active ? 'active' : 'off'})`], actor)
    setDialog(null)
    setToast(`Rule “${rule.name}” saved on this page only; automation rules aren’t stored yet`)
  }

  async function handleSaveTemplate(template: MessageTemplate) {
    const { id, name, category, channel, language, active, subject, body } = template
    const fields = { name, category, channel, language, active, subject, body }
    try {
      if (editingTemplate) await updateTemplate({ id, changes: fields }).unwrap()
      else await createTemplate(fields).unwrap()
      setDialog(null)
      setToast(`Template “${name}” saved`)
    } catch (error) {
      // The dialog stays open with what was typed
      setToast(describeError(error, 'The template wasn’t saved.'))
    }
  }

  async function handleToggleTemplate(template: MessageTemplate) {
    try {
      await updateTemplate({ id: template.id, changes: { active: !template.active } }).unwrap()
      setToast(`Template “${template.name}” ${template.active ? 'disabled' : 'enabled'}`)
    } catch (error) {
      setToast(describeError(error, 'The template wasn’t changed.'))
    }
  }

  async function handlePreferences(next: NotificationPreferences) {
    try {
      await savePreferences(next).unwrap()
    } catch (error) {
      setToast(describeError(error, 'The preferences weren’t saved.'))
    }
  }

  const blankRule: AutomationRule = { id: `RULE-${String(rules.length + 1).padStart(2, '0')}`, name: '', trigger: RULE_TRIGGERS[0], conditions: [], logic: 'AND', channels: ['SMS'], audience: RULE_RECIPIENTS[0], active: false, successRate: null, runs: 0 }
  const blankTemplate: MessageTemplate = { id: '', name: '', category: 'orders', channel: 'SMS', language: 'English', active: true, updatedAt: '', subject: '', body: '' }

  const header = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Notifications</h1>
          <p className="text-xs text-muted">
            Monitor alerts, customer messages, system events, and business communications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <button type="button" onClick={() => rulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={secondaryButton}>
                <Zap className="size-4 text-muted" aria-hidden="true" />
                Automations
              </button>
              <button type="button" onClick={() => templatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={secondaryButton}>
                <FileText className="size-4 text-muted" aria-hidden="true" />
                Templates
              </button>
            </>
          )}
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
          {canManage && (
            <button type="button" onClick={() => setDialog({ name: 'compose' })} className={`${primaryButton} max-md:hidden`}>
              <Plus className="size-4" aria-hidden="true" />
              Create Notification
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (inboxQuery.isLoading) {
    return (
      <>
        {header}
        <div className="animate-pulse space-y-4" aria-busy="true">
          <p className="sr-only" role="status">Loading notifications…</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-[76px] rounded-xl bg-white ring-1 ring-line" />
            ))}
          </div>
          <div className="h-12 rounded-xl bg-white ring-1 ring-line" />
          <div className="rounded-xl bg-white ring-1 ring-line">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
                <div className="size-4 rounded bg-field" />
                <div className="h-3 w-40 rounded bg-field" />
                <div className="h-3 flex-1 rounded bg-field" />
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  if (inboxQuery.isError && all.length === 0) {
    return (
      <>
        {header}
        <div role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-14 text-center ring-1 ring-line">
          <h2 className="text-sm font-bold text-ink">Couldn’t load the notifications</h2>
          <p className="max-w-md text-xs text-muted">{describeError(inboxQuery.error, 'The server refused the request.')}</p>
          <button type="button" onClick={() => void inboxQuery.refetch()} disabled={inboxQuery.isFetching} className={`${secondaryButton} mt-2`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {inboxQuery.isFetching ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {header}

      <NotificationKpis notifications={visible} selected={filters.tab} onTab={(tab) => patchFilters({ tab })} />

      {canManage && <ChannelHealth />}

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

      {canManage && (
        <>
          <div ref={rulesRef} className="scroll-mt-20">
            <RulesPanel
              rules={rules}
              canManage
              onToggle={(rule) => {
                notificationStore.saveRule({ ...rule, active: !rule.active }, [rule.active ? 'Rule disabled' : 'Rule activated', rule.name], actor)
                setToast(`Rule “${rule.name}” ${rule.active ? 'turned off' : 'activated'} on this page only`)
              }}
              onEdit={(id) => setDialog({ name: 'rule', id })}
              onCreate={() => setDialog({ name: 'rule', id: '' })}
            />
          </div>

          <div ref={templatesRef} className="scroll-mt-20">
            <TemplatesPanel
              templates={templates}
              loading={templateList.isLoading}
              failed={templateList.isError && !templateList.data}
              onRetry={() => void templateList.refetch()}
              canManage={canEditTemplates}
              onEdit={(id) => setDialog({ name: 'template', id })}
              onCreate={() => setDialog({ name: 'template', id: '' })}
              onToggle={(template) => void handleToggleTemplate(template)}
            />
          </div>

          <NotificationAnalytics notifications={visible} />

          <PreferencesPanel
            preferences={preferences}
            roleNames={roleNames}
            canManage
            onChange={(next) => void handlePreferences(next)}
          />

          <ActivityLogPanel log={log} />
        </>
      )}

      {canManage && (
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
        <ComposeDialog
          branches={branchOptions}
          branchStatus={{ loading: branchList.isLoading, failed: branchList.isError && !branchList.data, retry: () => void branchList.refetch() }}
          templates={templates}
          now={now} onClose={() => setDialog(null)} onSend={(input) => void handleSend(input)} />
      )}
      {dialog?.name === 'rule' && (
        <RuleDialog rule={editingRule ?? blankRule} onClose={() => setDialog(null)} onSave={handleSaveRule} />
      )}
      {dialog?.name === 'template' && (
        <TemplateDialog template={editingTemplate ?? blankTemplate} onClose={() => setDialog(null)} onSave={(template) => void handleSaveTemplate(template)} />
      )}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
      <span className="sr-only" aria-hidden="true">{user?.username}</span>
    </>
  )
}

export default NotificationsPage
