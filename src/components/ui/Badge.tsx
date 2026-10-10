import type { ReactNode } from 'react'

const TONE_CLASSES = {
  neutral: 'bg-field text-muted',
  brand: 'bg-brand/10 text-brand',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

export type BadgeTone = keyof typeof TONE_CLASSES

type BadgeProps = {
  tone?: BadgeTone
  children: ReactNode
}

function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}

export default Badge
