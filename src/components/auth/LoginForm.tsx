import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react'
import { getSettings } from '../../hooks/useSettings'
import { useLoginMutation } from '../../services/authApi'
import { errorMessage, safeRedirectPath } from '../../utils/apiErrors'
import FormAlert from '../ui/FormAlert'
import AuthFooter from './AuthFooter'
import AuthHeader from './AuthHeader'

type LoginFormValues = {
  username: string
  password: string
  remember: boolean
}

const labelClass = 'text-xs font-semibold text-ink'
const fieldClass =
  'h-11 w-full rounded-md bg-field pl-10 text-sm font-medium text-ink outline-none transition placeholder:font-normal placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-brand aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger'
const fieldIconClass =
  'pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted'
const fieldErrorClass = 'mt-1.5 text-[11px] font-semibold text-danger'

function LoginForm() {
  const id = useId()
  const navigate = useNavigate()
  const location = useLocation()
  // Set by ResetPasswordForm after a successful password change
  const passwordReset = location.state?.passwordReset === true
  // Set by RequireAuth: the page the user tried to open before signing in
  const returnTo = safeRedirectPath(location.state?.from)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    // Off by default: these are shared terminals
    defaultValues: { username: '', password: '', remember: false },
  })
  const [login, { error }] = useLoginMutation()
  const message = errorMessage(error, 'Incorrect username or password.')

  async function onSubmit({ username, password, remember }: LoginFormValues) {
    try {
      const { verification } = await login({
        username: username.trim(),
        password,
        remember,
      }).unwrap()
      if (verification) navigate('/verify')
      else navigate(returnTo ?? getSettings().startPage, { replace: true })
    } catch {
      // `error` drives the message above the fields
    }
  }

  return (
    <>
      <AuthHeader
        title="Sign in to FreshFlow"
        subtitle="Enterprise laundry & store management console"
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 space-y-4"
      >
        {passwordReset && (
          <FormAlert tone="success">
            Password updated. Sign in with your new password.
          </FormAlert>
        )}

        {message && <FormAlert>{message}</FormAlert>}

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor={`${id}-username`} className={labelClass}>
              Username
            </label>
          </div>
          <div className="relative mt-2">
            <User className={fieldIconClass} aria-hidden="true" />
            <input
              id={`${id}-username`}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Enter your username"
              aria-invalid={errors.username ? true : undefined}
              aria-describedby={
                errors.username ? `${id}-username-error` : undefined
              }
              {...register('username', {
                validate: (value) =>
                  value.trim() !== '' || 'Enter your username.',
              })}
              className={`${fieldClass} pr-3`}
            />
          </div>
          {errors.username && (
            <p id={`${id}-username-error`} className={fieldErrorClass}>
              {errors.username.message}
            </p>
          )}
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
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••••"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password ? `${id}-password-error` : undefined
              }
              {...register('password', { required: 'Enter your password.' })}
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
          {errors.password && (
            <p id={`${id}-password-error`} className={fieldErrorClass}>
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-ink">
            <input
              type="checkbox"
              {...register('remember')}
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
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in to Workspace'}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </form>

      <AuthFooter />
    </>
  )
}

export default LoginForm
