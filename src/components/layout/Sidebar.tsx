import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Building2,
  ChartColumn,
  ChevronDown,
  ClipboardList,
  Cpu,
  CreditCard,
  Layers,
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
import useCurrentUser from '../../hooks/useCurrentUser'
import useNotifications from '../../hooks/useNotifications'
import useSettings from '../../hooks/useSettings'
import { useLogoutMutation } from '../../services/authApi'
import { translate } from '../../utils/settings'

type NavItem = {
  label: string
  icon: LucideIcon
  badge?: string
  to?: string
  // Sub-pages; the item's own `to` is the section's base path
  children?: { label: string; to: string }[]
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
      { label: 'Laundry Operations', icon: WashingMachine, to: '/operations' },
      { label: 'Pickup & Delivery', icon: Truck, to: '/pickup-delivery' },
      { label: 'Payments', icon: CreditCard, to: '/payments' },
      { label: 'Inventory', icon: Package, badge: '2', to: '/inventory' },
      { label: 'Staff', icon: UserCog, to: '/staff' },
      { label: 'Reports', icon: ChartColumn },
      { label: 'Notifications', icon: Bell, to: '/notifications' },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Branches', icon: Store, to: '/branches' },
      { label: 'Machines', icon: Cpu, to: '/machines' },
      {
        label: 'Pricing',
        icon: Tag,
        to: '/pricing',
        children: [
          { label: 'Price List', to: '/pricing' },
          { label: 'Subscription Plans', to: '/pricing/subscriptions' },
        ],
      },
      { label: 'Promotions', icon: Megaphone, to: '/promotions' },
      { label: 'Settings', icon: Settings, to: '/settings' },
    ],
  },
  // TODO: show only to platform admins once the API exposes the user's role
  {
    title: 'Platform',
    items: [
      { label: 'Tenants', icon: Building2, to: '/tenants' },
      { label: 'Subscription Plans', icon: Layers, to: '/platform/plans' },
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
  const { language, showNavBadges } = useSettings()
  const { notifications } = useNotifications()
  // Same count as the bell: unread alerts addressed to staff
  const unread = notifications.filter(
    (item) => !item.read && !item.archived && item.delivery !== 'scheduled' && item.audience !== 'customer',
  ).length
  const t = (text: string) => translate(text, language)
  const navigate = useNavigate()
  const me = useCurrentUser()
  const { pathname } = useLocation()
  // Sections the user opened or closed by hand; otherwise a section is open while you're in it
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [logout, { isLoading: signingOut }] = useLogoutMutation()

  async function handleSignOut() {
    // Clears the local session even if the server call fails (see authApi)
    await logout().unwrap().catch(() => {})
    navigate('/login', { replace: true })
  }
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
              {me.workplace}
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
                {t(group.title)}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ label, icon: Icon, badge: fixedBadge, to, children }) => {
                  const badge = to === '/notifications' ? (unread > 0 ? String(unread) : undefined) : fixedBadge
                  const content = (
                    <>
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className={`flex-1 truncate ${labelClass}`}>
                        {t(label)}
                      </span>
                      {badge && showNavBadges && (
                        <span
                          className={`rounded-full bg-brand/10 px-1.5 text-[10px] font-bold text-brand in-aria-[current=page]:bg-white/20 in-aria-[current=page]:text-white ${labelClass}`}
                        >
                          {badge}
                        </span>
                      )}
                    </>
                  )
                  if (children && to) {
                    const inSection = pathname === to || pathname.startsWith(`${to}/`)
                    const open = expanded[label] ?? inSection
                    const subId = `nav-${to.slice(1)}`
                    return (
                      <li key={label}>
                        <div className="relative">
                          {/* The collapsed rail has no room for sub-items, so the icon links to the section */}
                          <Link
                            to={to}
                            onClick={() => {
                              setExpanded({ ...expanded, [label]: true })
                              onCloseMobile()
                            }}
                            title={collapsed ? t(label) : undefined}
                            className={`${itemClass} pr-8 ${inSection ? 'text-ink' : ''} ${collapsed && inSection ? 'lg:bg-brand lg:text-white lg:hover:bg-brand' : ''}`}
                          >
                            {content}
                          </Link>
                          <button
                            type="button"
                            onClick={() => setExpanded({ ...expanded, [label]: !open })}
                            aria-expanded={open}
                            aria-controls={subId}
                            aria-label={`${t(label)}: ${open ? 'collapse' : 'expand'}`}
                            className={`absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted transition hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${labelClass}`}
                          >
                            <ChevronDown className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
                          </button>
                        </div>
                        {open && (
                          <ul id={subId} className={`mt-0.5 ml-4 space-y-0.5 border-l border-line pl-2 ${labelClass}`}>
                            {children.map((child) => (
                              <li key={child.to}>
                                <NavLink
                                  to={child.to}
                                  end
                                  onClick={onCloseMobile}
                                  className={`${itemClass} h-7 font-medium aria-[current=page]:bg-brand aria-[current=page]:font-semibold aria-[current=page]:text-white aria-[current=page]:hover:bg-brand`}
                                >
                                  <span className="truncate">{t(child.label)}</span>
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  }
                  return (
                    <li key={label}>
                      {to ? (
                        <NavLink
                          to={to}
                          end={to === '/'}
                          onClick={onCloseMobile}
                          title={collapsed ? t(label) : undefined}
                          className={`${itemClass} aria-[current=page]:bg-brand aria-[current=page]:text-white aria-[current=page]:hover:bg-brand`}
                        >
                          {content}
                        </NavLink>
                      ) : (
                        // Pages that don't exist yet
                        <button
                          type="button"
                          title={collapsed ? t(label) : undefined}
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
            <span
              title={collapsed ? me.name : undefined}
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${me.isLoading ? 'animate-pulse bg-line' : 'bg-brand'}`}
            >
              {me.initials}
            </span>
            <div className={`min-w-0 flex-1 ${labelClass}`}>
              {me.isLoading ? (
                <>
                  <span className="sr-only" role="status">Loading your account…</span>
                  <span className="block h-3 w-24 animate-pulse rounded bg-field" />
                  <span className="mt-1 block h-2.5 w-16 animate-pulse rounded bg-field" />
                </>
              ) : (
                <>
                  <p className="truncate text-xs font-bold text-ink">
                    {me.name || (me.isError ? 'Unknown user' : '')}
                  </p>
                  <p className="truncate text-[10px] text-muted">
                    {me.isError ? 'Couldn’t load your profile' : me.roleLabel}
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label={t('Sign out')}
              title={t('Sign out')}
              className={`flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-50 ${labelClass}`}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
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
              {t(collapsed ? 'Expand Sidebar' : 'Collapse Sidebar')}
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
