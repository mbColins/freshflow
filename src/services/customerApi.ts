import type { ApiResponse } from '../types/api'
import type { CrmCustomer, CustomerNote } from '../types/customer'
import { customerFromApi } from '../utils/customers'
import { api } from './api'

// Nested records, named and shaped like the frontend's CrmCustomer
type RawAddress = {
  id?: string
  label?: string | null
  street?: string | null
  city?: string | null
  region?: string | null
  landmark?: string | null
  instructions?: string | null
  isDefault?: boolean
  default?: boolean
}

type RawCommunication = {
  id?: string
  at?: string | null
  channel?: string | null
  direction?: string | null
  message?: string | null
  status?: string | null
  by?: string | null
}

type RawPayment = {
  id?: string
  at?: string | null
  order?: string | null
  amount?: number | string | null
  method?: string | null
  reference?: string | null
  status?: string | null
  by?: string | null
}

type RawActivity = {
  at?: string | null
  type?: string | null
  text?: string | null
  related?: { kind?: string; id?: string } | null
  by?: string | null
}

// A customer from the API (CustomerResponse). Everything is optional so a
// different shape degrades to defaults instead of breaking the pages
export type CustomerResponse = {
  id?: string | number
  uuid?: string
  // Display name: "First Last", or the company name for a corporate customer
  name?: string | null
  firstname?: string | null
  lastname?: string | null
  companyName?: string | null
  // individual | corporate
  kind?: string | null
  phone?: string | null
  phoneNumber?: string | null
  email?: string | null
  // active | inactive | new | vip | suspended
  status?: string | null
  statusManual?: boolean
  points?: number | null
  loyaltyPoints?: number | null
  // bronze | silver | gold | platinum
  tier?: string | null
  pointsToNextTier?: number | null
  // Branch name, for display; branchId is its uuid
  branch?: { id?: string | number; uuid?: string; name?: string } | string | null
  branchId?: string | number | null
  branchName?: string | null
  referralSource?: string | null
  registeredAt?: string | null
  createdAt?: string | null
  lastOrderAt?: string | null
  orders?: number | null
  spent?: number | string | null
  outstanding?: number | string | null
  outstandingOrders?: number | null
  preferredService?: string | null
  homeAddress?: string | null
  neighbourhood?: string | null
  cadenceDays?: number | null
  tags?: string[] | null
  addresses?: RawAddress[] | null
  laundry?: {
    detergent?: string | null
    softener?: string | null
    folding?: string | null
    packaging?: string | null
    ironing?: boolean | null
    instructions?: string | null
  } | null
  delivery?: { method?: string | null; window?: string | null; instructions?: string | null } | null
  notes?: { id?: string; text?: string | null; by?: string | null; at?: string | null }[] | null
  communications?: RawCommunication[] | null
  payments?: RawPayment[] | null
  activity?: RawActivity[] | null
  monthlyOrders?: number[] | null
  monthlySpend?: (number | string)[] | null
  consent?: { channel?: string | null; marketing?: boolean | null } | null
  corporate?: {
    contact?: string | null
    taxId?: string | null
    billingAddress?: string | null
    terms?: string | null
    creditLimit?: number | string | null
    contract?: string | null
  } | null
  archived?: boolean
  createdBy?: string | null
}

// The create / update body (CustomerRequest). On PATCH a missing field is left
// unchanged. Notes and loyalty points are not sent here: they have their own
// endpoints, and the server stamps who wrote a note
export type CustomerRequest = {
  kind?: 'individual' | 'corporate'
  firstname?: string
  lastname?: string
  companyName?: string
  phone?: string
  email?: string
  status?: string
  // false hands the status back to the nightly rules
  statusManual?: boolean
  homeAddress?: string
  neighbourhood?: string
  // Opening balance, create only
  loyaltyPoints?: number
  referralSource?: string
  preferredService?: string
  archived?: boolean
  // Branch uuid
  branchId?: string
  tags?: string[]
  addresses?: {
    id: string
    label: string
    street: string
    city: string
    region: string
    landmark: string
    instructions: string
    isDefault: boolean
  }[]
  laundry?: {
    detergent: string
    softener: string
    folding: string
    packaging: string
    ironing: boolean
    instructions: string
  }
  delivery?: { method: 'pickup' | 'delivery'; window: string; instructions: string }
  // The one channel the customer is reached on
  consent?: { channel: 'SMS' | 'WHATSAPP' | 'EMAIL'; marketing: boolean }
  corporate?: {
    contact: string
    taxId: string
    billingAddress: string
    terms: string
    creditLimit: number
    contract: string
  }
}

export type CustomerPage = { items: CrmCustomer[]; total: number }

export type CustomerListParams = { page?: number; size?: number }

// One choice in GET /customer/dropdown (DropDownResponse): the id, uuid,
// display name and phone number. There's no email or address.
export type CustomerOption = { id: number | null; uuid: string; name: string; phone: string }

export type CustomerDropdownParams = {
  // Matches first name, last name, company name or phone, case-insensitive
  search?: string
  // How many to return; the backend defaults to 10
  size?: number
}

export type MessageChannel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'CALL'

// A message the platform sent, or a contact logged by hand
export type CommunicationEntry = {
  id: string
  at: string
  channel: MessageChannel
  direction: 'OUTBOUND' | 'INBOUND'
  message: string
  // DELIVERED, FAILED, QUEUED or LOGGED
  status: string
  by: string
}

// Derived timeline entry; `related` says what it is about, e.g. ORDER / ORD-10452
export type TimelineEntry = {
  at: string
  type: string
  text: string
  related: { kind: string; id: string } | null
  by: string
}

export type LoyaltyReason = 'ORDER_COMPLETED' | 'REDEEMED' | 'ADJUSTMENT' | 'EXPIRED' | 'REFERRAL' | 'PROMOTION'

export type LoyaltyEntry = {
  id: string
  at: string
  // Signed
  points: number
  reason: LoyaltyReason | string
  reference: string
  balanceAfter: number
  by: string
}

export type SendMessageBody = {
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL'
  message: string
  marketing?: boolean
  // ISO local date time; sent later when set
  scheduledFor?: string
}

export type BulkMessageBody = SendMessageBody & {
  // Exactly one of customers and segment
  customers?: string[]
  segment?: string
}

export type BulkMessageResult = {
  requested: number
  sent: number
  skipped: { reason: string; count: number }[]
  scheduled: number
}

export type MergeResult = {
  into: string
  from: string
  orders: number
  payments: number
  communications: number
  messages: number
  notes: number
  points: number
}

export type DuplicateGroup = {
  matchedOn: 'phone' | 'email'
  value: string
  customers: {
    id: string
    name: string
    phone: string
    email: string
    branch: string
    orders: number
    lastOrderAt: string | null
    registeredAt: string
  }[]
}

export type ImportResult = {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

// A list in the content as a bare array, our paged shape ({ data }) or Spring's ({ content })
function pageItems(content: unknown) {
  const page = content as { data?: unknown[]; content?: unknown[]; totalElements?: number } | null
  const items = Array.isArray(content) ? content : (page?.data ?? page?.content ?? [])
  return { items, total: page?.totalElements ?? items.length }
}

// The created customer's id, when the create response carries the customer
function createdId(content: unknown) {
  const raw = content as CustomerResponse | null
  const id = typeof raw === 'object' && raw ? (raw.uuid ?? raw.id) : undefined
  return id === undefined || id === null ? null : String(id)
}

const text = (value: string | null | undefined) => value ?? ''
const num = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
}

function toCommunications(content: unknown): CommunicationEntry[] {
  return (pageItems(content).items as RawCommunication[]).map((raw, index) => ({
    id: raw.id ?? String(index),
    at: text(raw.at),
    channel: (['SMS', 'WHATSAPP', 'EMAIL', 'CALL'].includes(raw.channel ?? '') ? raw.channel : 'SMS') as MessageChannel,
    direction: raw.direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
    message: text(raw.message),
    status: text(raw.status),
    by: text(raw.by),
  }))
}

function toTimeline(content: unknown): TimelineEntry[] {
  return (pageItems(content).items as RawActivity[]).map((raw) => ({
    at: text(raw.at),
    type: text(raw.type),
    text: text(raw.text),
    related: raw.related?.kind ? { kind: raw.related.kind, id: text(raw.related.id) } : null,
    by: text(raw.by),
  }))
}

function toLedger(content: unknown): LoyaltyEntry[] {
  return (
    pageItems(content).items as {
      id?: string
      at?: string | null
      points?: number | null
      reason?: string | null
      reference?: string | null
      balanceAfter?: number | null
      by?: string | null
    }[]
  ).map((raw, index) => ({
    id: raw.id ?? String(index),
    at: text(raw.at),
    points: num(raw.points),
    reason: text(raw.reason),
    reference: text(raw.reference),
    balanceAfter: num(raw.balanceAfter),
    by: text(raw.by),
  }))
}

const DROPDOWN = { type: 'Customer' as const, id: 'DROPDOWN' }
const LIST = { type: 'Customer' as const, id: 'LIST' }
const one = (id: string) => ({ type: 'Customer' as const, id })
// What hangs off one customer, so a new note or message refreshes only its own tabs
const part = (id: string, name: string) => ({ type: 'Customer' as const, id: `${id}:${name}` })
// A message, a note or a loyalty change also changes the customer's profile and timeline
const touched = (id: string, ...names: string[]) => [one(id), part(id, 'activity'), ...names.map((name) => part(id, name))]

// Paths are relative to /api/v1/customer. The backend scopes every call: the
// platform admin sees all, the owner their tenant, anyone else their branch.
export const customerApi = api.injectEndpoints({
  endpoints: (build) => ({
    // GET /customer: the customers the caller may see, in pages
    listCustomers: build.query<CustomerPage, CustomerListParams | void>({
      query: (params) => ({ url: '/customer', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<unknown>) => {
        const { items, total } = pageItems(response.content)
        return { items: (items as CustomerResponse[]).flatMap((raw) => customerFromApi(raw) ?? []), total }
      },
      providesTags: [LIST],
    }),
    // Also carries the latest communications (10), payments (5) and activity (10)
    getCustomer: build.query<CrmCustomer | null, string>({
      query: (customerId) => `/customer/${encodeURIComponent(customerId)}`,
      transformResponse: (response: ApiResponse<CustomerResponse>) => customerFromApi(response.content),
      providesTags: (_result, _error, customerId) => [one(customerId)],
    }),
    // Search-as-you-type on name, company and phone, for the order form
    getCustomerDropdown: build.query<CustomerOption[], CustomerDropdownParams | void>({
      query: (params) => ({ url: '/customer/dropdown', params: params ?? undefined }),
      transformResponse: (response: ApiResponse<unknown>) =>
        (
          pageItems(response.content).items as {
            id?: number | null
            uuid?: string
            name?: string | null
            phoneNumber?: string | null
          }[]
        ).flatMap((raw) =>
          raw.uuid
            ? [
                {
                  id: raw.id ?? null,
                  uuid: raw.uuid,
                  name: raw.name?.trim() || 'Unnamed customer',
                  phone: raw.phoneNumber?.trim() ?? '',
                },
              ]
            : [],
        ),
      providesTags: [DROPDOWN],
    }),
    // Resolves to the new customer's id when the response carries it
    createCustomer: build.mutation<string | null, CustomerRequest>({
      query: (body) => ({ url: '/customer', method: 'POST', body }),
      transformResponse: (response: ApiResponse<unknown>) => createdId(response.content),
      invalidatesTags: [LIST, DROPDOWN],
    }),
    // Only the fields given are changed; a new branchId is checked against the tenant
    updateCustomer: build.mutation<void, { id: string; changes: Partial<CustomerRequest> }>({
      query: ({ id, changes }) => ({ url: `/customer/${encodeURIComponent(id)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => [...touched(id), LIST, DROPDOWN],
    }),
    deleteCustomer: build.mutation<void, string>({
      query: (id) => ({ url: `/customer/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, id) => [one(id), LIST, DROPDOWN],
    }),

    // ---- Notes
    // The author and time are the caller's and the server's. 422 text_required
    addCustomerNote: build.mutation<CustomerNote | null, { id: string; text: string }>({
      query: ({ id, text }) => ({ url: `/customer/${encodeURIComponent(id)}/notes`, method: 'POST', body: { text } }),
      transformResponse: (response: ApiResponse<{ id?: string; text?: string; by?: string; at?: string } | null>) =>
        response.content?.id
          ? { id: response.content.id, text: text(response.content.text), by: text(response.content.by), at: text(response.content.at) }
          : null,
      invalidatesTags: (_result, _error, { id }) => touched(id),
    }),
    // The author, a manager or the owner
    deleteCustomerNote: build.mutation<void, { id: string; noteId: string }>({
      query: ({ id, noteId }) => ({
        url: `/customer/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`,
        method: 'DELETE',
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => touched(id),
    }),

    // ---- Communications
    // Newest first: every message the platform sent plus the contacts logged by hand
    listCommunications: build.query<CommunicationEntry[], { id: string; page?: number; size?: number }>({
      query: ({ id, page = 0, size = 50 }) => ({
        url: `/customer/${encodeURIComponent(id)}/communications`,
        params: { page, size },
      }),
      transformResponse: (response: ApiResponse<unknown>) => toCommunications(response.content),
      providesTags: (_result, _error, { id }) => [part(id, 'communications')],
    }),
    // Logs a call or contact made outside the app
    logCommunication: build.mutation<void, { id: string; channel: MessageChannel; message: string; direction?: 'OUTBOUND' | 'INBOUND' }>({
      query: ({ id, ...body }) => ({ url: `/customer/${encodeURIComponent(id)}/communications`, method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => touched(id, 'communications'),
    }),
    // Sends through the dispatcher now, or at `scheduledFor`. 409 no_consent,
    // customer_archived; 400 no_contact_for_channel
    sendCustomerMessage: build.mutation<void, { id: string } & SendMessageBody>({
      query: ({ id, ...body }) => ({ url: `/customer/${encodeURIComponent(id)}/message`, method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => touched(id, 'communications'),
    }),
    // Customers without consent or an address are counted as skipped, not failed
    sendBulkMessage: build.mutation<BulkMessageResult, BulkMessageBody>({
      query: (body) => ({ url: '/customer/message', method: 'POST', body }),
      transformResponse: (response: ApiResponse<{ requested?: number; sent?: number; skipped?: { reason?: string; count?: number }[]; scheduled?: number } | null>) => ({
        requested: response.content?.requested ?? 0,
        sent: response.content?.sent ?? 0,
        skipped: (response.content?.skipped ?? []).map((item) => ({ reason: text(item.reason), count: item.count ?? 0 })),
        scheduled: response.content?.scheduled ?? 0,
      }),
      invalidatesTags: [LIST],
    }),

    // ---- Activity and loyalty
    getCustomerActivity: build.query<TimelineEntry[], { id: string; page?: number; size?: number }>({
      query: ({ id, page = 0, size = 50 }) => ({
        url: `/customer/${encodeURIComponent(id)}/activity`,
        params: { page, size },
      }),
      transformResponse: (response: ApiResponse<unknown>) => toTimeline(response.content),
      providesTags: (_result, _error, { id }) => [part(id, 'activity')],
    }),
    // The points ledger, newest first
    getLoyaltyLedger: build.query<LoyaltyEntry[], { id: string; page?: number; size?: number }>({
      query: ({ id, page = 0, size = 50 }) => ({
        url: `/customer/${encodeURIComponent(id)}/loyalty`,
        params: { page, size },
      }),
      transformResponse: (response: ApiResponse<unknown>) => toLedger(response.content),
      providesTags: (_result, _error, { id }) => [part(id, 'loyalty')],
    }),
    // Managers and the owner. `points` is signed; 409 insufficient_points below 0
    adjustLoyalty: build.mutation<void, { id: string; points: number; reason: string }>({
      query: ({ id, ...body }) => ({ url: `/customer/${encodeURIComponent(id)}/loyalty/adjust`, method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => [...touched(id, 'loyalty'), LIST],
    }),
    // Takes the points off and discounts the open order by points x xafPerPoint
    redeemLoyalty: build.mutation<void, { id: string; points: number; order: string }>({
      query: ({ id, ...body }) => ({ url: `/customer/${encodeURIComponent(id)}/loyalty/redeem`, method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => [...touched(id, 'loyalty'), LIST, { type: 'Order' as const, id: 'LIST' }],
    }),

    // ---- Duplicates, merge and import (managers and the owner)
    listDuplicates: build.query<DuplicateGroup[], void>({
      query: () => '/customer/duplicates',
      transformResponse: (response: ApiResponse<DuplicateGroup[] | null>) =>
        (response.content ?? []).map((group) => ({
          ...group,
          customers: (group.customers ?? []).map((customer) => ({
            ...customer,
            email: text(customer.email),
            lastOrderAt: customer.lastOrderAt ?? null,
          })),
        })),
      providesTags: [LIST],
    }),
    // Moves the source's orders, payments, messages, notes and points to `into`,
    // then archives the source. Not reversible
    mergeCustomers: build.mutation<MergeResult | null, { id: string; into: string }>({
      query: ({ id, into }) => ({ url: `/customer/${encodeURIComponent(id)}/merge`, method: 'POST', body: { into } }),
      transformResponse: (response: ApiResponse<MergeResult | null>) => response.content,
      invalidatesTags: (_result, _error, { id, into }) => [one(id), one(into), LIST, DROPDOWN],
    }),
    // A CSV with the columns kind, firstname, lastname, companyName, phone, email,
    // address, neighbourhood, tags; up to 1000 rows. Wrong rows are listed and left out
    importCustomers: build.mutation<ImportResult, { file: File; branch: string; mode?: 'SKIP' | 'UPDATE' }>({
      query: ({ file, branch, mode = 'SKIP' }) => {
        const body = new FormData()
        body.append('file', file)
        body.append('branch', branch)
        body.append('mode', mode)
        return { url: '/customer/import', method: 'POST', body }
      },
      transformResponse: (response: ApiResponse<Partial<ImportResult> | null>) => ({
        created: response.content?.created ?? 0,
        updated: response.content?.updated ?? 0,
        skipped: response.content?.skipped ?? 0,
        errors: response.content?.errors ?? [],
      }),
      invalidatesTags: [LIST, DROPDOWN],
    }),
  }),
})

export const {
  useListCustomersQuery,
  useGetCustomerQuery,
  useGetCustomerDropdownQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useAddCustomerNoteMutation,
  useDeleteCustomerNoteMutation,
  useListCommunicationsQuery,
  useLogCommunicationMutation,
  useSendCustomerMessageMutation,
  useSendBulkMessageMutation,
  useGetCustomerActivityQuery,
  useGetLoyaltyLedgerQuery,
  useAdjustLoyaltyMutation,
  useRedeemLoyaltyMutation,
  useListDuplicatesQuery,
  useMergeCustomersMutation,
  useImportCustomersMutation,
} = customerApi
