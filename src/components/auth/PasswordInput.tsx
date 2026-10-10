import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = {
  id: string
  name: string
  icon: LucideIcon
  value: string
  onChange: (value: string) => void
  autoComplete: string
  describedBy?: string
  invalid?: boolean
}

function PasswordInput({
  id,
  name,
  icon: Icon,
  value,
  onChange,
  autoComplete,
  describedBy,
  invalid = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative mt-2">
      <Icon
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        placeholder="••••••••••••"
        aria-describedby={describedBy}
        aria-invalid={invalid}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md bg-field pr-11 pl-10 text-sm font-medium text-ink outline-none transition placeholder:font-normal placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-brand aria-invalid:ring-1 aria-invalid:ring-red-500"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

export default PasswordInput
