import { useEffect, useState } from 'react'
import { Globe, Mail, Palette, Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../components/orders/OrderDialogs'
import type { ConfirmRequest } from '../components/orders/OrderDialogs'
import { fieldClass, labelClass, primaryButton, secondaryButton } from '../components/orders/styles'
import Badge from '../components/ui/Badge'
import type { BadgeTone } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import useCurrentUser from '../hooks/useCurrentUser'
import {
  useCreatePlatformSubdomainMutation,
  useCreateTenantConfigurationMutation,
  useDeleteDomainMutation,
  useGetTenantConfigurationQuery,
  useListAppConfigsQuery,
  useListDomainsQuery,
  useRequestCustomDomainMutation,
  useUpdateAppConfigMutation,
  useUpdateTenantConfigurationMutation,
} from '../services/businessSettingsApi'
import type { AppConfig, AppConfigChanges, ConfigChannel, DomainStatus, TenantConfiguration } from '../services/businessSettingsApi'
import { useGetTenantDropdownQuery } from '../services/tenantApi'
import { describeError } from '../utils/apiReasons'

const TOAST_MS = 5000
const CHANNELS: { id: ConfigChannel; label: string }[] = [
  { id: 'EMAIL', label: 'Email' },
  { id: 'SMS', label: 'SMS' },
  { id: 'PUSH', label: 'Push' },
]
const DOMAIN_STATUS: Record<DomainStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  PENDING_DNS: { label: 'Waiting for DNS', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
}
const EMPTY_CONFIG: TenantConfiguration = {
  logoUrl: '',
  primaryColor: '#2a78d6',
  receiptTemplate: '',
  defaultCurrency: 'XAF',
  defaultLanguage: 'en',
  defaultTimezone: 'Africa/Douala',
  enabledNotificationChannels: ['EMAIL'],
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  )
}

// What the business looks like and sends: its configuration
function ConfigurationPanel({ tenantId, onToast }: { tenantId: string; onToast: (message: string) => void }) {
  const { data, isLoading, error } = useGetTenantConfigurationQuery(tenantId)
  const [create, { isLoading: creating }] = useCreateTenantConfigurationMutation()
  const [update, { isLoading: updating }] = useUpdateTenantConfigurationMutation()
  // 404: the business hasn't been configured yet, so the first save creates it
  const missing = (error as { status?: number } | undefined)?.status === 404
  const [draft, setDraft] = useState<TenantConfiguration | null>(null)
  const form = draft ?? data ?? EMPTY_CONFIG
  const patch = (change: Partial<TenantConfiguration>) => setDraft({ ...form, ...change })

  async function handleSave() {
    try {
      if (missing) await create({ tenantId, config: form }).unwrap()
      else await update({ tenantId, config: form }).unwrap()
      setDraft(null)
      onToast('Business settings saved')
    } catch (caught) {
      onToast(describeError(caught, 'The settings weren’t saved.'))
    }
  }

  return (
    <Panel title="Business Settings" subtitle="Branding, defaults and the channels your business uses" icon={Palette}>
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-md bg-field" aria-busy="true">
          <p className="sr-only" role="status">Loading settings…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {missing && <p className="rounded-lg bg-field p-3 text-xs text-muted">This business hasn’t been configured yet. Saving creates its settings.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="cfg-color" label="Brand colour">
              <div className="flex items-center gap-2">
                <input id="cfg-color" type="color" value={form.primaryColor || '#2a78d6'} onChange={(event) => patch({ primaryColor: event.target.value })} className="h-9 w-12 rounded-md bg-field p-1" />
                <input aria-label="Brand colour code" value={form.primaryColor} onChange={(event) => patch({ primaryColor: event.target.value })} className={`${fieldClass} font-mono`} />
              </div>
            </Field>
            <Field id="cfg-logo" label="Logo address">
              <input id="cfg-logo" value={form.logoUrl} onChange={(event) => patch({ logoUrl: event.target.value })} placeholder="https://…" className={fieldClass} />
            </Field>
            <Field id="cfg-currency" label="Currency">
              <input id="cfg-currency" value={form.defaultCurrency} onChange={(event) => patch({ defaultCurrency: event.target.value.toUpperCase() })} className={fieldClass} />
            </Field>
            <Field id="cfg-language" label="Language">
              <select id="cfg-language" value={form.defaultLanguage} onChange={(event) => patch({ defaultLanguage: event.target.value })} className={fieldClass}>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </Field>
            <Field id="cfg-timezone" label="Time zone">
              <input id="cfg-timezone" value={form.defaultTimezone} onChange={(event) => patch({ defaultTimezone: event.target.value })} placeholder="Africa/Douala" className={fieldClass} />
            </Field>
            <fieldset>
              <legend className={labelClass}>Notification channels</legend>
              <div className="flex flex-wrap gap-4 pt-1.5">
                {CHANNELS.map(({ id, label }) => (
                  <label key={id} className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={form.enabledNotificationChannels.includes(id)}
                      onChange={(event) =>
                        patch({
                          enabledNotificationChannels: event.target.checked
                            ? [...form.enabledNotificationChannels, id]
                            : form.enabledNotificationChannels.filter((channel) => channel !== id),
                        })
                      }
                      className="size-4 accent-brand"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <Field id="cfg-receipt" label="Receipt template">
            <textarea id="cfg-receipt" rows={3} value={form.receiptTemplate} onChange={(event) => patch({ receiptTemplate: event.target.value })} className={`${fieldClass} h-auto py-2`} />
          </Field>
          <div className="flex justify-end gap-2">
            {draft && (
              <button type="button" onClick={() => setDraft(null)} className={secondaryButton}>
                Discard
              </button>
            )}
            <button type="button" onClick={() => void handleSave()} disabled={!draft || creating || updating} className={primaryButton}>
              {creating || updating ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}

// The addresses the business is reached at
function DomainsPanel({ tenantId, onToast }: { tenantId: string; onToast: (message: string) => void }) {
  const { data: domains = [], isLoading } = useListDomainsQuery(tenantId)
  const [createSubdomain, { isLoading: creating }] = useCreatePlatformSubdomainMutation()
  const [requestDomain, { isLoading: requesting }] = useRequestCustomDomainMutation()
  const [removeDomain] = useDeleteDomainMutation()
  const [hostname, setHostname] = useState('')
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const hasPlatform = domains.some(({ type }) => type === 'PLATFORM_SUBDOMAIN')

  async function run(action: () => Promise<unknown>, done: string, fallback: string) {
    try {
      await action()
      onToast(done)
    } catch (caught) {
      onToast(describeError(caught, fallback))
    }
  }

  return (
    <Panel
      title="Domains"
      subtitle="Where customers and staff reach your business"
      icon={Globe}
      action={
        !hasPlatform && (
          <button type="button" disabled={creating} onClick={() => void run(() => createSubdomain(tenantId).unwrap(), 'Platform address created', 'The address wasn’t created.')} className={secondaryButton}>
            {creating ? 'Creating…' : 'Create platform address'}
          </button>
        )
      }
    >
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-md bg-field" aria-busy="true" />
      ) : domains.length === 0 ? (
        <p className="rounded-lg bg-field px-3 py-6 text-center text-xs text-muted">No domains yet.</p>
      ) : (
        <ul className="space-y-2">
          {domains.map((domain) => (
            <li key={domain.id} className="rounded-lg bg-field p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">
                  {domain.hostname}
                  {domain.primary && <span className="ml-2 font-normal text-muted">primary</span>}
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone={DOMAIN_STATUS[domain.status].tone}>{DOMAIN_STATUS[domain.status].label}</Badge>
                  {!domain.primary && (
                    <button
                      type="button"
                      aria-label={`Remove ${domain.hostname}`}
                      onClick={() =>
                        setConfirm({
                          title: `Remove ${domain.hostname}?`,
                          body: 'Customers and staff can no longer reach the business at this address.',
                          confirmLabel: 'Remove Domain',
                          destructive: true,
                          onConfirm: () => void run(() => removeDomain({ tenantId, domainId: domain.id }).unwrap(), 'Domain removed', 'The domain wasn’t removed.'),
                        })
                      }
                      className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-white hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              {domain.status === 'PENDING_DNS' && domain.verificationToken && (
                <p className="mt-2 text-[11px] text-muted">
                  Add this verification record to the domain’s DNS: <span className="font-mono break-all text-ink">{domain.verificationToken}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const value = hostname.trim().toLowerCase()
          if (!value) return
          void run(() => requestDomain({ tenantId, hostname: value }).unwrap(), 'Domain requested. Add its DNS record to verify it.', 'The domain wasn’t requested.').then(() => setHostname(''))
        }}
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="domain-host" className={labelClass}>
            Use your own domain
          </label>
          <input id="domain-host" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="laundry.example.com" className={fieldClass} />
        </div>
        <button type="submit" disabled={requesting || !hostname.trim()} className={primaryButton}>
          <Plus className="size-4" aria-hidden="true" />
          {requesting ? 'Requesting…' : 'Request Domain'}
        </button>
      </form>
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </Panel>
  )
}

// The platform's mail account and one-time-code settings. Secrets are blank
// and only sent when something is typed in them
function AppConfigPanel({ config, onToast }: { config: AppConfig; onToast: (message: string) => void }) {
  const [update, { isLoading }] = useUpdateAppConfigMutation()
  const [draft, setDraft] = useState({
    email: config.email,
    host: config.host,
    port: config.port === null ? '' : String(config.port),
    appEmail: config.appEmail,
    optExpiryTime: config.optExpiryTime === null ? '' : String(config.optExpiryTime),
    smsPublicKey: config.smsPublicKey,
    emailPassword: '',
    smsPrivateKey: '',
  })
  const set = (key: keyof typeof draft, value: string) => setDraft({ ...draft, [key]: value })

  async function handleSave() {
    const changes: AppConfigChanges = {
      email: draft.email,
      host: draft.host,
      appEmail: draft.appEmail,
      smsPublicKey: draft.smsPublicKey,
      ...(draft.port ? { port: Number(draft.port) } : {}),
      ...(draft.optExpiryTime ? { optExpiryTime: Number(draft.optExpiryTime) } : {}),
      ...(draft.emailPassword ? { emailPassword: draft.emailPassword } : {}),
      ...(draft.smsPrivateKey ? { smsPrivateKey: draft.smsPrivateKey } : {}),
    }
    try {
      await update({ id: config.id, changes }).unwrap()
      setDraft({ ...draft, emailPassword: '', smsPrivateKey: '' })
      onToast('Platform mail settings saved')
    } catch (caught) {
      onToast(describeError(caught, 'The settings weren’t saved.'))
    }
  }

  return (
    <Panel title="Platform Mail & SMS" subtitle="The account the platform sends from. Platform admins only" icon={Mail}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="app-email" label="Mail account">
          <input id="app-email" value={draft.email} onChange={(event) => set('email', event.target.value)} className={fieldClass} />
        </Field>
        <Field id="app-password" label="Mail password">
          <input id="app-password" type="password" autoComplete="new-password" placeholder="Leave blank to keep it" value={draft.emailPassword} onChange={(event) => set('emailPassword', event.target.value)} className={fieldClass} />
        </Field>
        <Field id="app-host" label="Mail server">
          <input id="app-host" value={draft.host} onChange={(event) => set('host', event.target.value)} className={fieldClass} />
        </Field>
        <Field id="app-port" label="Port">
          <input id="app-port" type="number" inputMode="numeric" value={draft.port} onChange={(event) => set('port', event.target.value)} className={fieldClass} />
        </Field>
        <Field id="app-from" label="Sender address">
          <input id="app-from" value={draft.appEmail} onChange={(event) => set('appEmail', event.target.value)} className={fieldClass} />
        </Field>
        <Field id="app-otp" label="One-time code validity (minutes)">
          <input id="app-otp" type="number" inputMode="numeric" value={draft.optExpiryTime} onChange={(event) => set('optExpiryTime', event.target.value)} className={fieldClass} />
        </Field>
        <Field id="app-sms-public" label="SMS public key">
          <input id="app-sms-public" value={draft.smsPublicKey} onChange={(event) => set('smsPublicKey', event.target.value)} className={fieldClass} />
        </Field>
        <Field id="app-sms-private" label="SMS private key">
          <input id="app-sms-private" type="password" autoComplete="new-password" placeholder="Leave blank to keep it" value={draft.smsPrivateKey} onChange={(event) => set('smsPrivateKey', event.target.value)} className={fieldClass} />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => void handleSave()} disabled={isLoading} className={primaryButton}>
          {isLoading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Panel>
  )
}

function BusinessSettingsPage() {
  const { user, isPlatformAdmin } = useCurrentUser()
  const isOwner = user?.userType === 'TENANT'
  const tenants = useGetTenantDropdownQuery(undefined, { skip: !isOwner && !isPlatformAdmin })
  // A platform admin picks the business; an owner has only their own
  const [chosen, setChosen] = useState('')
  const tenantId = chosen || tenants.data?.[0]?.uuid || ''
  const appConfigs = useListAppConfigsQuery(undefined, { skip: !isPlatformAdmin })
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Business Settings</h1>
          <p className="text-xs text-muted">How your business looks, where it lives online, and what it sends.</p>
        </div>
        {isPlatformAdmin && (tenants.data?.length ?? 0) > 1 && (
          <label className="flex items-center gap-2 text-[11px] text-muted">
            Business
            <select value={tenantId} onChange={(event) => setChosen(event.target.value)} className={`${fieldClass} h-8 w-auto!`}>
              {tenants.data?.map(({ uuid, name }) => (
                <option key={uuid} value={uuid}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!isOwner && !isPlatformAdmin ? (
        <p className="rounded-xl bg-white px-4 py-14 text-center text-xs text-muted ring-1 ring-line">Only the business owner can change these settings.</p>
      ) : tenants.isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-white ring-1 ring-line" aria-busy="true" />
      ) : tenantId ? (
        <>
          <ConfigurationPanel key={`cfg-${tenantId}`} tenantId={tenantId} onToast={setToast} />
          <DomainsPanel key={`dom-${tenantId}`} tenantId={tenantId} onToast={setToast} />
        </>
      ) : (
        <p className="rounded-xl bg-white px-4 py-14 text-center text-xs text-muted ring-1 ring-line">No business to configure.</p>
      )}

      {isPlatformAdmin && (appConfigs.data ?? []).map((config) => <AppConfigPanel key={config.id} config={config} onToast={setToast} />)}

      {toast && (
        <p role="status" className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          {toast}
        </p>
      )}
    </>
  )
}

export default BusinessSettingsPage
