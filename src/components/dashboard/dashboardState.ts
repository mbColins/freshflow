import { createContext, useContext } from 'react'

export const VIEW_STATES = [
  { value: 'normal', label: 'Normal' },
  { value: 'skeleton', label: 'Skeleton' },
  { value: 'empty', label: 'Empty' },
  { value: 'error', label: 'Error' },
] as const

export type ViewState = (typeof VIEW_STATES)[number]['value']

export const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'counter', label: 'Counter' },
  { value: 'plant', label: 'Plant Op' },
] as const

export type Role = (typeof ROLES)[number]['value']

export type SectionId =
  | 'kpis'
  | 'revenue'
  | 'pipeline'
  | 'attention'
  | 'logistics'
  | 'orders'
  | 'equipment'
  | 'supplies'
  | 'staff'
  | 'insights'
  | 'events'

const ALL_SECTIONS: SectionId[] = [
  'kpis',
  'revenue',
  'pipeline',
  'attention',
  'logistics',
  'orders',
  'equipment',
  'supplies',
  'staff',
  'insights',
  'events',
]

export const ROLE_SECTIONS: Record<Role, SectionId[]> = {
  admin: ALL_SECTIONS,
  manager: ALL_SECTIONS,
  counter: ['kpis', 'pipeline', 'attention', 'logistics', 'orders', 'events'],
  plant: [
    'pipeline',
    'attention',
    'orders',
    'equipment',
    'supplies',
    'staff',
    'events',
  ],
}

type DashboardView = {
  viewState: ViewState
  onRetry: () => void
}

export const DashboardViewContext = createContext<DashboardView>({
  viewState: 'normal',
  onRetry: () => {},
})

export function useDashboardView() {
  return useContext(DashboardViewContext)
}
