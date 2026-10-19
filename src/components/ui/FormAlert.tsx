import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'

const TONES = {
  danger: { className: 'bg-danger/10 text-danger', icon: CircleAlert, role: 'alert' },
  success: { className: 'bg-success/10 text-success', icon: CircleCheck, role: 'status' },
} as const

type FormAlertProps = {
  tone?: keyof typeof TONES
  children: ReactNode
}

// Banner above a form's fields for a submit result
function FormAlert({ tone = 'danger', children }: FormAlertProps) {
  const { className, icon: Icon, role } = TONES[tone]
  return (
    <p
      role={role}
      className={`flex items-center gap-2 rounded-md px-3.5 py-3 text-xs font-semibold ${className}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

export default FormAlert
