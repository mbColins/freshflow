import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Menu, Plus, Search, Store } from 'lucide-react'
import useCurrentUser from '../../hooks/useCurrentUser'
import NotificationBell from './NotificationBell'


type TopbarProps = {
  onOpenMenu: () => void
}

function Topbar({ onOpenMenu }: TopbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const me = useCurrentUser()

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
        {me.workplace && (
          <p
            title="Where you work"
            className="hidden h-9 max-w-48 items-center gap-2 rounded-md bg-field px-3 text-xs font-semibold text-ink md:flex"
          >
            <Store className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">{me.workplace}</span>
          </p>
        )}

        <Link
          to="/orders?new=1"
          className="hidden h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex"
        >
          <Plus className="size-4" aria-hidden="true" />
          New Order
        </Link>

        <NotificationBell />

        <span
          title={me.user ? me.user.username || me.user.email : undefined}
          aria-label={me.name ? `Signed in as ${me.name}` : undefined}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white"
        >
          {me.isLoading ? '' : me.initials}
        </span>
      </div>
    </header>
  )
}

export default Topbar
