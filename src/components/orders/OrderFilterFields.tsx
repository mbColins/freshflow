import {
  PAYMENT_STATUSES,
  PRIORITIES,
  SERVICES,
  STATUSES,
} from '../../constants/orders'
import useBranchNames from '../../hooks/useBranchNames'
import useStaff from '../../hooks/useStaff'
import type { OrderFilters } from '../../types/order'
import { fieldClass } from './styles'

type FilterKey = Exclude<keyof OrderFilters, 'query' | 'group' | 'minAmount' | 'maxAmount'>

const OPTIONS: Record<
  FilterKey,
  { label: string; all: string; options: { value: string; label: string }[] }
> = {
  status: {
    label: 'Status',
    all: 'All statuses',
    options: STATUSES.map(({ id, label }) => ({ value: id, label })),
  },
  payment: {
    label: 'Payment status',
    all: 'All payments',
    options: PAYMENT_STATUSES.map(({ id, label }) => ({ value: id, label })),
  },
  service: {
    label: 'Service',
    all: 'All services',
    options: SERVICES.map((service) => ({ value: service, label: service })),
  },
  due: {
    label: 'Due date',
    all: 'Any due date',
    options: [
      { value: 'overdue', label: 'Overdue' },
      { value: 'today', label: 'Due today' },
      { value: 'tomorrow', label: 'Due tomorrow' },
      { value: 'week', label: 'Next 7 days' },
    ],
  },
  branch: {
    label: 'Branch',
    all: 'All branches',
    options: [],
  },
  priority: {
    label: 'Priority',
    all: 'Any priority',
    options: PRIORITIES.map(({ id, label }) => ({ value: id, label })),
  },
  method: {
    label: 'Delivery method',
    all: 'Pickup & delivery',
    options: [
      { value: 'pickup', label: 'Customer pickup' },
      { value: 'delivery', label: 'Delivery' },
    ],
  },
  staff: {
    label: 'Assigned staff',
    all: 'All staff',
    options: [],
  },
  customerType: {
    label: 'Customer type',
    all: 'All customers',
    options: [
      { value: 'new', label: 'New customer' },
      { value: 'returning', label: 'Returning customer' },
      { value: 'corporate', label: 'Corporate account' },
    ],
  },
}

type FilterSelectProps = {
  name: FilterKey
  filters: OrderFilters
  onChange: (patch: Partial<OrderFilters>) => void
  className?: string
}

// One filter dropdown, shared by the toolbar and the More Filters panel
function FilterSelect({
  name,
  filters,
  onChange,
  className = '',
}: FilterSelectProps) {
  const { label, all, options: fixed } = OPTIONS[name]
  const staff = useStaff()
  const branches = useBranchNames().names
  // Staff and branches come from the API
  const options =
    name === 'staff'
      ? staff.map(({ name: person }) => ({ value: person, label: person }))
      : name === 'branch'
        ? branches.map((branch) => ({ value: branch, label: branch }))
        : fixed
  return (
    <select
      aria-label={label}
      value={filters[name]}
      onChange={(event) => onChange({ [name]: event.target.value })}
      className={`${fieldClass} ${className}`}
    >
      <option value="">{all}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default FilterSelect
