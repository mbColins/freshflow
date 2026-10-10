import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Bell, CalendarDays, Menu, Plus, Search, Store } from 'lucide-react'

const BRANCHES = ['Downtown Branch', 'Akwa Branch', 'Bonapriso Branch']
const DATE_RANGES = ['Today', 'Yesterday', 'Last 7 days', 'This month']
const NOTIFICATION_COUNT = 4

const selectClass =
  'h-9 cursor-pointer appearance-none rounded-md bg-field pr-3 pl-8 text-xs font-semibold text-ink outline-none transition focus:ring-2 focus:ring-brand'
const selectIconClass =
  'pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted'

type TopbarProps = {
  onOpenMenu: () => void
}

function Topbar({ onOpenMenu }: TopbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-white px-4 lg:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search orders, clients, tickets"
          placeholder="Search orders, clients, tickets…"
          className="h-9 w-full rounded-md bg-field pr-14 pl-8 text-xs font-medium text-ink outline-none transition placeholder:font-normal placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-brand"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded bg-white px-1.5 py-0.5 font-sans text-[9px] font-bold text-muted ring-1 ring-line sm:block">
          Ctrl K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Store className={selectIconClass} aria-hidden="true" />
          <select aria-label="Branch" className={selectClass}>
            {BRANCHES.map((branch) => (
              <option key={branch}>{branch}</option>
            ))}
          </select>
        </div>
        <div className="relative hidden md:block">
          <CalendarDays className={selectIconClass} aria-hidden="true" />
          <select aria-label="Date range" className={selectClass}>
            {DATE_RANGES.map((range) => (
              <option key={range}>{range}</option>
            ))}
          </select>
        </div>

        <Link
          to="/orders?new=1"
          className="hidden h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex"
        >
          <Plus className="size-4" aria-hidden="true" />
          New Order
        </Link>

        <button
          type="button"
          aria-label={`Notifications, ${NOTIFICATION_COUNT} unread`}
          className="relative flex size-9 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <Bell className="size-4" aria-hidden="true" />
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
            {NOTIFICATION_COUNT}
          </span>
        </button>

        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
          MV
        </span>
      </div>
    </header>
  )
}

export default Topbar
