import type { ReactNode } from 'react'
import { labelClass } from '../orders/styles'

type FormFieldProps = {
  label: string
  htmlFor: string
  // Spans both columns of a two-column form grid
  wide?: boolean
  hint?: string
  // Shown instead of the hint; give the input aria-describedby={`${htmlFor}-error`}
  error?: string
  children: ReactNode
}

// Label + control (+ hint or error) for dialog and wizard forms
function FormField({ label, htmlFor, wide = false, hint, error, children }: FormFieldProps) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-[11px] font-semibold text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>
      )}
    </div>
  )
}

export default FormField
