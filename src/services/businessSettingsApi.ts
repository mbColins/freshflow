import type { ApiResponse } from '../types/api'
import { api } from './api'

// ---------- Tenant configuration ----------

export type ConfigChannel = 'EMAIL' | 'SMS' | 'PUSH'

export type TenantConfiguration = {
  logoUrl: string
  primaryColor: string
  receiptTemplate: string
  defaultCurrency: string
  defaultLanguage: string
  defaultTimezone: string
  enabledNotificationChannels: ConfigChannel[]
}

type RawConfiguration = Partial<Omit<TenantConfiguration, 'enabledNotificationChannels'>> & {
  enabledNotificationChannels?: string[] | null
}

const toConfiguration = (raw: RawConfiguration | null): TenantConfiguration => ({
  logoUrl: raw?.logoUrl ?? '',
  primaryColor: raw?.primaryColor ?? '',
  receiptTemplate: raw?.receiptTemplate ?? '',
  defaultCurrency: raw?.defaultCurrency ?? '',
  defaultLanguage: raw?.defaultLanguage ?? '',
  defaultTimezone: raw?.defaultTimezone ?? '',
  enabledNotificationChannels: (raw?.enabledNotificationChannels ?? []) as ConfigChannel[],
})

// ---------- Domains ----------

export type DomainType = 'PLATFORM_SUBDOMAIN' | 'CUSTOM_DOMAIN'
export type DomainStatus = 'PENDING_DNS' | 'ACTIVE' | 'FAILED'

export type TenantDomain = {
  // The API addresses a domain by this number
  id: number
  hostname: string
  type: DomainType
  primary: boolean
  status: DomainStatus
  // The record to add to the domain's DNS while it is PENDING_DNS
  verificationToken: string
  verifiedAt: string
}

type RawDomain = {
  id?: number
  hostname?: string
  type?: string
  primaryDomain?: boolean
  status?: string
  verificationToken?: string | null
  verifiedAt?: string | null
}

// ---------- App config (platform admin) ----------

export type AppConfig = {
  id: number
  // The SMTP account the platform sends mail from
  email: string
  host: string
  port: number | null
  appEmail: string
  // How long a one-time code stays valid, in minutes
  optExpiryTime: number | null
  smsPublicKey: string
}

// Secrets are only sent when changed
export type AppConfigChanges = Partial<{
  email: string
  host: string
  port: number
  emailPassword: string
  appEmail: string
  optExpiryTime: number
  smsPrivateKey: string
  smsPublicKey: string
}>

type RawAppConfig = {
  id?: number
  email?: string | null
  host?: string | null
  port?: number | null
  appEmail?: string | null
  optExpiryTime?: number | null
  smsPublicKey?: string | null
}

const CONFIG = (id: string) => ({ type: 'TenantConfig' as const, id })
const DOMAINS = (id: string) => ({ type: 'Domain' as const, id })
const APP = { type: 'AppConfig' as const, id: 'LIST' }

export const businessSettingsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // 404 when the tenant has no configuration yet
    getTenantConfiguration: build.query<TenantConfiguration, string>({
      query: (tenantId) => `/tenant-configuration/${encodeURIComponent(tenantId)}`,
      transformResponse: (response: ApiResponse<RawConfiguration>) => toConfiguration(response.content),
      providesTags: (_result, _error, tenantId) => [CONFIG(tenantId)],
    }),
    // 409 tenant_configuration_already_exist
    createTenantConfiguration: build.mutation<void, { tenantId: string; config: Partial<TenantConfiguration> }>({
      query: ({ tenantId, config }) => ({ url: `/tenant-configuration/${encodeURIComponent(tenantId)}`, method: 'POST', body: config }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { tenantId }) => [CONFIG(tenantId)],
    }),
    updateTenantConfiguration: build.mutation<void, { tenantId: string; config: Partial<TenantConfiguration> }>({
      query: ({ tenantId, config }) => ({ url: `/tenant-configuration/${encodeURIComponent(tenantId)}`, method: 'PATCH', body: config }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { tenantId }) => [CONFIG(tenantId)],
    }),

    listDomains: build.query<TenantDomain[], string>({
      query: (tenantId) => `/tenant/${encodeURIComponent(tenantId)}/domain/`,
      transformResponse: (response: ApiResponse<RawDomain[]>) =>
        (Array.isArray(response.content) ? response.content : []).flatMap((raw) =>
          raw?.id !== undefined && raw.hostname
            ? [
                {
                  id: raw.id,
                  hostname: raw.hostname,
                  type: (raw.type ?? 'CUSTOM_DOMAIN') as DomainType,
                  primary: raw.primaryDomain === true,
                  status: (raw.status ?? 'PENDING_DNS') as DomainStatus,
                  verificationToken: raw.verificationToken ?? '',
                  verifiedAt: raw.verifiedAt ?? '',
                },
              ]
            : [],
        ),
      providesTags: (_result, _error, tenantId) => [DOMAINS(tenantId)],
    }),
    // The tenant's address on the platform, e.g. acme.eazypressing.app
    createPlatformSubdomain: build.mutation<void, string>({
      query: (tenantId) => ({ url: `/tenant/${encodeURIComponent(tenantId)}/domain/platform`, method: 'POST' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, tenantId) => [DOMAINS(tenantId)],
    }),
    // Starts PENDING_DNS until the verification record is in place
    requestCustomDomain: build.mutation<void, { tenantId: string; hostname: string }>({
      query: ({ tenantId, hostname }) => ({
        url: `/tenant/${encodeURIComponent(tenantId)}/domain/`,
        method: 'POST',
        body: { hostname, type: 'CUSTOM_DOMAIN' },
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { tenantId }) => [DOMAINS(tenantId)],
    }),
    deleteDomain: build.mutation<void, { tenantId: string; domainId: number }>({
      query: ({ tenantId, domainId }) => ({ url: `/tenant/${encodeURIComponent(tenantId)}/domain/${domainId}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { tenantId }) => [DOMAINS(tenantId)],
    }),

    listAppConfigs: build.query<AppConfig[], void>({
      query: () => '/app_config',
      transformResponse: (response: ApiResponse<RawAppConfig[]>) =>
        (Array.isArray(response.content) ? response.content : []).flatMap((raw) =>
          raw?.id !== undefined
            ? [
                {
                  id: raw.id,
                  email: raw.email ?? '',
                  host: raw.host ?? '',
                  port: raw.port ?? null,
                  appEmail: raw.appEmail ?? '',
                  optExpiryTime: raw.optExpiryTime ?? null,
                  smsPublicKey: raw.smsPublicKey ?? '',
                },
              ]
            : [],
        ),
      providesTags: [APP],
    }),
    // The id goes in the query string, not the path
    updateAppConfig: build.mutation<void, { id: number; changes: AppConfigChanges }>({
      query: ({ id, changes }) => ({ url: '/app_config', method: 'PATCH', params: { id }, body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: [APP],
    }),
  }),
})

export const {
  useGetTenantConfigurationQuery,
  useCreateTenantConfigurationMutation,
  useUpdateTenantConfigurationMutation,
  useListDomainsQuery,
  useCreatePlatformSubdomainMutation,
  useRequestCustomDomainMutation,
  useDeleteDomainMutation,
  useListAppConfigsQuery,
  useUpdateAppConfigMutation,
} = businessSettingsApi
