import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type AuthPanelProps = {
  badgeIcon: LucideIcon
  badge: string
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

function AuthPanel({
  badgeIcon: BadgeIcon,
  badge,
  title,
  description,
  children,
  footer,
}: AuthPanelProps) {
  return (
    <aside className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-linear-to-br from-brand from-10% via-brand-dark via-70% to-accent p-8 text-white lg:flex">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase ring-1 ring-white/20">
          <BadgeIcon className="size-3.5" aria-hidden="true" />
          {badge}
        </span>

        <h1 className="mt-6 text-3xl leading-tight font-bold tracking-tight">
          {title}
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/85">
          {description}
        </p>
      </div>

      <div className="rounded-xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur-sm">
        {children}
      </div>

      {footer}
    </aside>
  )
}

export default AuthPanel
