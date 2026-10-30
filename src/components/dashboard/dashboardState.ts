import type { UserType } from '../../types/user'

export const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'counter', label: 'Counter' },
  { value: 'plant', label: 'Plant Op' },
] as const

export type Role = (typeof ROLES)[number]['value']

// The dashboard a user type gets: owners and admins see everything, managers
// too, front-desk staff the counter view, washers and cleaners the plant view
export function roleForUserType(userType: UserType | null | undefined): Role {
  switch (userType) {
    case 'SYSTEM_ADMIN':
    case 'TENANT':
    case 'OWNER':
      return 'admin'
    case 'WASHER':
    case 'DRY_CLEANER':
      return 'plant'
    case 'FRONT_DESK':
    case 'STAFF_MEMBER':
    case 'DELIVERY_AGENT':
      return 'counter'
    default:
      return 'manager'
  }
}

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
