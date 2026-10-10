import { Link, NavLink } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  ChartColumn,
  ClipboardList,
  Cpu,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shirt,
  Store,
  Tag,
  Truck,
  UserCog,
  Users,
  WashingMachine,
} from 'lucide-react'

type NavItem = {
  label: string
  icon: LucideIcon
  badge?: string
  to?: string
}

const itemClass =
  'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-xs font-semibold text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
      { label: 'Orders', icon: ClipboardList, badge: '86', to: '/orders' },
      { label: 'Customers', icon: Users, to: '/customers' },
      { label: 'Services', icon: Shirt, to: '/services' },
      { label: 'Laundry Operations', icon: WashingMachine },
      { label: 'Pickup & Delivery', icon: Truck, to: '/pickup-delivery' },
      { label: 'Payments', icon: CreditCard, to: '/payments' },
      { label: 'Inventory', icon: Package, badge: '2', to: '/inventory' },
      { label: 'Staff', icon: UserCog, to: '/staff' },
      { label: 'Reports', icon: ChartColumn },
      { label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Branches', icon: Store },
      { label: 'Machines', icon: Cpu },
      { label: 'Pricing', icon: Tag },
      { label: 'Promotions', icon: Megaphone },
      { label: 'Settings', icon: Settings },
    ],
  },
]

type SidebarProps = {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  // Labels stay visible in the mobile drawer; only the desktop rail collapses
  const labelClass = collapsed ? 'lg:hidden' : ''

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-line bg-white transition-transform lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-16' : 'lg:w-60'}`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-white">
            <WashingMachine className="size-4" aria-hidden="true" />
          </span>
          <div className={`min-w-0 ${labelClass}`}>
            <p className="text-sm leading-tight font-bold text-ink">
              FreshFlow
            </p>
            <p className="truncate text-[9px] font-semibold tracking-wider text-muted uppercase">
              Downtown Hub #4
            </p>
          </div>
        </div>

        <nav
          aria-label="Main"
          className="flex-1 space-y-4 overflow-y-auto px-2 py-3"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p
                className={`px-2 pb-1.5 text-[9px] font-bold tracking-wider text-muted uppercase ${labelClass}`}
              >
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ label, icon: Icon, badge, to }) => {
                  const content = (
                    <>
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className={`flex-1 truncate ${labelClass}`}>
                        {label}
                      </span>
                      {badge && (
                        <span
                          className={`rounded-full bg-brand/10 px-1.5 text-[10px] font-bold text-brand in-aria-[current=page]:bg-white/20 in-aria-[current=page]:text-white ${labelClass}`}
                        >
                          {badge}
                        </span>
                      )}
                    </>
                  )
                  return (
                    <li key={label}>
                      {to ? (
                        <NavLink
                          to={to}
                          end={to === '/'}
                          onClick={onCloseMobile}
                          title={collapsed ? label : undefined}
                          className={`${itemClass} aria-[current=page]:bg-brand aria-[current=page]:text-white aria-[current=page]:hover:bg-brand`}
                        >
                          {content}
                        </NavLink>
                      ) : (
                        // Pages that don't exist yet
                        <button
                          type="button"
                          title={collapsed ? label : undefined}
                          className={itemClass}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              MV
            </span>
            <div className={`min-w-0 flex-1 ${labelClass}`}>
              <p className="truncate text-xs font-bold text-ink">
                Marcus Vance
              </p>
              <p className="truncate text-[10px] text-muted">
                Manager / Lead Op
              </p>
            </div>
            <Link
              to="/login"
              aria-label="Sign out"
              title="Sign out"
              className={`flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${labelClass}`}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            className="mt-1 hidden h-8 w-full items-center justify-center gap-2 rounded-md text-[11px] font-semibold text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
            <span className={collapsed ? 'sr-only' : ''}>
              {collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
