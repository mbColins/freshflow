import type { ApiResponse } from '../types/api'
import { api } from './api'

// Backend MachineType
export type MachineKind = 'WASHING_MACHINE' | 'DRYER' | 'DRY_CLEANING_MACHINE' | 'STEAM_PRESS' | 'OZONE_CHAMBER'

export const MACHINE_KINDS: Record<MachineKind, string> = {
  WASHING_MACHINE: 'Washing machine',
  DRYER: 'Dryer',
  DRY_CLEANING_MACHINE: 'Dry-cleaning machine',
  STEAM_PRESS: 'Steam press',
  OZONE_CHAMBER: 'Ozone chamber',
}

// The machine's profile as stored. The server doesn't track what a machine is
// doing (status, load, cycle, maintenance) yet
export type ServerMachine = {
  id: string
  // Unique per branch
  code: string
  name: string
  type: MachineKind | ''
  manufacturer: string
  model: string
  serialNumber: string
  yearPurchased: number | null
  description: string
  branchId: string
  branchName: string
  area: string
  zone: string
  specs: Record<string, unknown>
  capabilities: string[]
  purchaseCost: number | null
  maintenanceEveryDays: number | null
  createdBy: string
  createdAt: string
}

// MachineRequest; PATCH changes only the fields sent, and a new `branch` moves the machine
export type MachineRequest = Partial<{
  code: string
  name: string
  type: MachineKind
  manufacturer: string
  model: string
  serialNumber: string
  yearPurchased: number
  description: string
  // Branch uuid
  branch: string
  area: string
  zone: string
  specs: Record<string, unknown>
  capabilities: string[]
  purchaseCost: number
  maintenanceEveryDays: number
}>

type RawMachine = {
  uuid?: string
  code?: string | null
  name?: string | null
  type?: string | null
  manufacturer?: string | null
  model?: string | null
  serialNumber?: string | null
  yearPurchased?: number | null
  description?: string | null
  branch?: string | null
  branchName?: string | null
  area?: string | null
  zone?: string | null
  specs?: Record<string, unknown> | null
  capabilities?: string[] | null
  purchaseCost?: number | string | null
  maintenanceEveryDays?: number | null
  createdBy?: string | null
  createdAt?: string | null
}

// BigDecimal may arrive as a number or a string
const toAmount = (value: unknown) => {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null
}

function toMachines(items: unknown): ServerMachine[] {
  return (Array.isArray(items) ? (items as RawMachine[]) : []).flatMap((raw) =>
    raw?.uuid
      ? [
          {
            id: raw.uuid,
            code: raw.code ?? '',
            name: raw.name ?? raw.code ?? '',
            type: (raw.type ?? '') as MachineKind | '',
            manufacturer: raw.manufacturer ?? '',
            model: raw.model ?? '',
            serialNumber: raw.serialNumber ?? '',
            yearPurchased: raw.yearPurchased ?? null,
            description: raw.description ?? '',
            branchId: raw.branch ?? '',
            branchName: raw.branchName ?? '',
            area: raw.area ?? '',
            zone: raw.zone ?? '',
            specs: raw.specs ?? {},
            capabilities: raw.capabilities ?? [],
            purchaseCost: toAmount(raw.purchaseCost),
            maintenanceEveryDays: raw.maintenanceEveryDays ?? null,
            createdBy: raw.createdBy ?? '',
            createdAt: raw.createdAt ?? '',
          },
        ]
      : [],
  )
}

export type MachineListParams = { filter?: string; search?: string; page?: number; size?: number }
export type MachinePage = { items: ServerMachine[]; total: number }

const LIST = { type: 'Machine' as const, id: 'LIST' }

export const machineApi = api.injectEndpoints({
  endpoints: (build) => ({
    // Scoped by the backend: a platform admin sees every machine, a business
    // owner their tenant's, anyone else their own branch. `filter` and
    // `search` are required by the endpoint, so they are always sent
    listMachines: build.query<MachinePage, MachineListParams | void>({
      query: (params) => ({ url: '/machines/', params: { filter: '', search: '', ...(params ?? {}) } }),
      transformResponse: (response: ApiResponse<{ data?: unknown[]; totalElements?: number }>) => {
        const items = toMachines(response.content?.data)
        return { items, total: response.content?.totalElements ?? items.length }
      },
      providesTags: [LIST],
    }),
    getMachine: build.query<ServerMachine | undefined, string>({
      query: (id) => `/machines/${encodeURIComponent(id)}`,
      transformResponse: (response: ApiResponse<RawMachine>) => toMachines([response.content])[0],
      providesTags: (_result, _error, id) => [{ type: 'Machine', id }],
    }),
    // 409 machine_code_already_exist when the code is taken in that branch
    createMachine: build.mutation<void, MachineRequest>({
      query: (body) => ({ url: '/machines/', method: 'POST', body }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
    updateMachine: build.mutation<void, { id: string; changes: MachineRequest }>({
      query: ({ id, changes }) => ({ url: `/machines/${encodeURIComponent(id)}`, method: 'PATCH', body: changes }),
      transformResponse: () => undefined,
      invalidatesTags: (_result, _error, { id }) => [LIST, { type: 'Machine', id }],
    }),
    deleteMachine: build.mutation<void, string>({
      query: (id) => ({ url: `/machines/${encodeURIComponent(id)}`, method: 'DELETE' }),
      transformResponse: () => undefined,
      invalidatesTags: [LIST],
    }),
  }),
})

export const {
  useListMachinesQuery,
  useGetMachineQuery,
  useCreateMachineMutation,
  useUpdateMachineMutation,
  useDeleteMachineMutation,
} = machineApi
