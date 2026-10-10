import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  ArrowRight,
  CircleCheck,
  Eye,
  EyeOff,
  IdCard,
  Lock,
  Store,
  Truck,
  UserCog,
} from 'lucide-react'
import AuthFooter from './AuthFooter'
import AuthHeader from './AuthHeader'

const ROLES = [
  { value: 'store-staff', label: 'Store Staff', icon: Store },
  { value: 'facility-admin', label: 'Facility Admin', icon: UserCog },
  { value: 'route-driver', label: 'Route Driver', icon: Truck },
] as const

type Role = (typeof ROLES)[number]['value']

const labelClass = 'text-xs font-semibold text-ink'
const fieldClass =
  'h-11 w-full rounded-md bg-field pl-10 text-sm font-medium text-ink outline-none transition placeholder:font-normal placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-brand'
const fieldIconClass =
  'pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted'

function LoginForm() {
  const id = useId()
  const navigate = useNavigate()
  // Set by ResetPasswordForm after a successful password change
  const passwordReset = useLocation().state?.passwordReset === true
  const [role, setRole] = useState<Role>('store-staff')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // TODO: send { role, identifier, password, remember } to the auth API
    navigate('/verify')
  }

  return (
    <>
      <AuthHeader
        title="Sign in to FreshFlow"
        subtitle="Enterprise laundry & store management console"
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {passwordReset && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md bg-success/10 px-3.5 py-3 text-xs font-semibold text-success"
          >
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            Password updated. Sign in with your new password.
          </p>
        )}

        <fieldset>
          <legend className={labelClass}>Select Operating Role</legend>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-field p-1">
            {ROLES.map(({ value, label, icon: Icon }) => (
              <label
                key={value}
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md text-xs font-semibold text-muted transition hover:text-ink has-checked:bg-white has-checked:text-brand has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-brand"
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="sr-only"
                />
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor={`${id}-identifier`} className={labelClass}>
              Email
            </label>
          </div>
          <div className="relative mt-2">
            <IdCard className={fieldIconClass} aria-hidden="true" />
            <input
              id={`${id}-identifier`}
              name="identifier"
              type="text"
              autoComplete="username"
              required
              placeholder="operator.name@freshflow.io or Badge ID"
              aria-describedby={`${id}-identifier-hint`}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className={`${fieldClass} pr-3`}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor={`${id}-password`} className={labelClass}>
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-[11px] font-semibold text-brand hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-2">
            <Lock className={fieldIconClass} aria-hidden="true" />
            <input
              id={`${id}-password`}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${fieldClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-ink">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-4 rounded accent-brand"
            />
            Remember this terminal workstation
          </label>
          <span className="text-[10px] font-semibold text-success">
            Auto-locks after 30m idle
          </span>
        </div>

        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Sign in to Workspace
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>

       


      </form>

      <AuthFooter />
    </>
  )
}

export default LoginForm
