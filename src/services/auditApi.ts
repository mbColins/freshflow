import type { ApiResponse } from '../types/api'
import { api } from './api'

// What an entry is about; anything else is a 400 invalid_entity_type
export const AUDIT_ENTITY_TYPES = [
  'ORDER',
  'PAYMENT',
  'REFUND',
  'CUSTOMER',
  'SERVICE',
  'PRICE',
  'PROMOTION',
  'STAFF',
  'ROLE',
  'MACHINE',
  'INVENTORY',
  'MESSAGE',
] as const

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export type AuditEntry = {
  id: string
  entityType: string
  // Uuid of the record the entry is about
  entity: string
  action: string
  summary: string
  // The record's fields before and after the change; either can be absent
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  // First and last name of whoever did it
  actor: string
  at: string
}

export type AuditParams = {
  entityType?: AuditEntityType | ''
  entity?: string
  // yyyy-MM-dd, both inclusive
  from?: string
  to?: string
  page?: number
  size?: number
}

export type AuditPage = { items: AuditEntry[]; total: number; totalPages: number }

type RawEntry = {
  uuid?: string
  entityType?: string | null
  entity?: string | null
  action?: string | null
  summary?: string | null
  before?: unknown
  after?: unknown
  actor?: string | null
  at?: string | null
}

const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

export const auditApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Newest first. Scoped by the backend: a platform admin sees everything, a
    // business owner their tenant, anyone else their branch
    listAudit: build.query<AuditPage, AuditParams>({
      query: ({ entityType, entity, from, to, page, size }) => ({
        url: '/audit',
        params: {
          ...(entityType ? { entityType } : {}),
          ...(entity ? { entity } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          page,
          size,
        },
      }),
      transformResponse: (response: ApiResponse<{ data?: RawEntry[]; totalElements?: number; totalPages?: number }>) => {
        const items = (response.content?.data ?? []).flatMap((raw) =>
          raw?.uuid
            ? [
                {
                  id: raw.uuid,
                  entityType: raw.entityType ?? '',
                  entity: raw.entity ?? '',
                  action: raw.action ?? '',
                  summary: raw.summary ?? '',
                  before: asRecord(raw.before),
                  after: asRecord(raw.after),
                  actor: raw.actor ?? '',
                  at: raw.at ?? '',
                },
              ]
            : [],
        )
        return {
          items,
          total: response.content?.totalElements ?? items.length,
          totalPages: response.content?.totalPages ?? 1,
        }
      },
      providesTags: [{ type: 'Audit', id: 'LIST' }],
    }),
  }),
})

export const { useListAuditQuery } = auditApi
