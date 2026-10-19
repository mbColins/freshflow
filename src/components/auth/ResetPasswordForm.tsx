import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import { useResetPasswordMutation, useSetPasswordMutation } from '../../services/authApi'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { logout, selectVerification } from '../../store/slices/authSlice'
import { NETWORK_ERROR_MESSAGE, serverMessage } from '../../utils/apiErrors'
import FormAlert from '../ui/FormAlert'
import AuthFooter from './AuthFooter'
import AuthHeader from './AuthHeader'
import PasswordInput from './PasswordInput'

type ResetPasswordValues = {
  password: string
  confirmPassword: string
  signOutOthers: boolean
}

// The backend's policy (weak_password otherwise): 8–128 characters with at
// least one letter and one digit
const CRITERIA = [
  {
    label: '8 to 128 characters',
    test: (value: string) => value.length >= 8 && value.length <= 128,
  },
  { label: 'At least 1 letter', test: (value: string) => /[A-Za-z]/.test(value) },
  { label: 'At least 1 number', test: (value: string) => /\d/.test(value) },
]

// What went wrong, from the backend's error code
function failureMessage(error: unknown, recovery: boolean) {
  const status = (error as { status?: unknown } | undefined)?.status
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') return NETWORK_ERROR_MESSAGE
  const code = (serverMessage(error) ?? '').toLowerCase().replace(/[\s-]+/g, '_')
  if (code.includes('weak_password')) {
    return 'The password needs 8 to 128 characters, with at least one letter and one number.'
  }
  if (code.includes('different_from_old')) return 'Choose a password different from your current one.'
  if (code.includes('otp_not_found') || code.includes('otp_expired')) {
    return 'This code has expired or was already used. Request a new code.'
  }
  if (recovery && (status === 401 || code.includes('invalid'))) {
    return 'The code is incorrect. Go back and check it, or request a new one.'
  }
  if (status === 401 || status === 403) return 'Your session expired. Sign in again to set your password.'
  return 'This password was not accepted. Try a different one.'
}

const STRENGTH_LEVELS = [
  { label: 'Weak Password', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Fair Password', bar: 'bg-amber-500', text: 'text-amber-600' },
  { label: 'Strong Password', bar: 'bg-success', text: 'text-success' },
  { label: 'Very Strong Password', bar: 'bg-success', text: 'text-success' },
]

const labelClass = 'text-xs font-semibold text-ink'

function getStrengthScore(password: string, metCount: number) {
  if (!password) return 0
  const lengthBonus = metCount === CRITERIA.length && password.length >= 14
  return Math.max(1, metCount + (lengthBonus ? 1 : 0))
}

function ResetPasswordForm() {
  const id = useId()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  // Set by login or forgot password; OTP validation adds the resetUuid and
  // resetToken used here
  const verification = useAppSelector(selectVerification)
  // Set once the reset succeeds, so clearing `verification` doesn't trip the
  // redirect below while the navigation (a React transition) is still pending
  const [done, setDone] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResetPasswordValues>({
    defaultValues: { password: '', confirmPassword: '', signOutOthers: true },
  })
  const [password, confirmPassword] = useWatch({
    control,
    name: ['password', 'confirmPassword'],
  })
  // First login sets the password with the token from OTP validation; forgot
  // password sends the typed code with the new password
  const recovery = verification?.role === 'FORGOT_PASSWORD'
  const [setPassword, { error: setError }] = useSetPasswordMutation()
  const [resetPassword, { error: resetError }] = useResetPasswordMutation()
  const error = recovery ? resetError : setError
  const message = error ? failureMessage(error, recovery) : null

  const results = CRITERIA.map(({ label, test }) => ({
    label,
    met: test(password),
  }))
  const metCount = results.filter(({ met }) => met).length
  const score = getStrengthScore(password, metCount)
  const strength = score > 0 ? STRENGTH_LEVELS[score - 1] : null
  const meetsPolicy = metCount === CRITERIA.length
  const matches = confirmPassword !== '' && confirmPassword === password
  const mismatch = confirmPassword !== '' && confirmPassword !== password

  // TODO: send `signOutOthers` once the API supports it
  // The confirmation is checked here only; the API takes the new password alone
  async function onSubmit({ password }: ResetPasswordValues) {
    if (!verification) return
    try {
      if (recovery) {
        if (!verification.resetCode) return
        await resetPassword({
          uuid: verification.uuid,
          otp: verification.resetCode,
          newPassword: password,
        }).unwrap()
      } else {
        if (!verification.resetUuid) return
        await setPassword({
          uuid: verification.resetUuid,
          token: verification.resetToken,
          newPassword: password,
        }).unwrap()
      }
      setDone(true)
      // Also drops any PRE_AUTH token from a first login: the user signs in
      // again with the new password
      dispatch(logout())
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch {
      // `error` drives the message above the fields
    }
  }

  // Reached without a code (e.g. after a reload): back to the start of
  // whichever flow sent the user here
  if (!(recovery ? verification?.resetCode : verification?.resetUuid)) {
    if (done) return null
    const start =
      verification?.role === 'FIRST_LOGIN' ? '/login' : '/forgot-password'
    return <Navigate to={start} replace />
  }

  return (
    <>
      <AuthHeader
        title="Create New Password"
        subtitle="Commercial laundry OS credential reset"
      />

      <p className="mt-5 text-xs leading-relaxed text-muted">
        Enter a strong password for operator account
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-5 space-y-4"
      >
        {message && <FormAlert>{message}</FormAlert>}

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor={`${id}-password`} className={labelClass}>
              New  Password
            </label>
            <a
              href="#"
              className="text-[11px] font-semibold text-brand hover:underline"
            >
              Policy guidelines
            </a>
          </div>
          <Controller
            control={control}
            name="password"
            rules={{ validate: () => meetsPolicy }}
            render={({ field }) => (
              <PasswordInput
                id={`${id}-password`}
                name={field.name}
                icon={Lock}
                value={field.value}
                onChange={field.onChange}
                autoComplete="new-password"
                describedBy={`${id}-criteria`}
              />
            )}
          />

          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] font-semibold">
              <span className="text-ink">Security Evaluation</span>
              <span
                className={`flex items-center gap-1.5 ${strength ? strength.text : 'text-muted'}`}
                aria-live="polite"
              >
                <span className="size-1.5 rounded-full bg-current" />
                {strength ? strength.label : 'Enter a password'}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
              {STRENGTH_LEVELS.map((level, index) => (
                <span
                  key={level.label}
                  className={`h-1.5 rounded-full transition-colors ${
                    strength && index < score ? strength.bar : 'bg-ink/10'
                  }`}
                />
              ))}
            </div>
            <ul
              id={`${id}-criteria`}
              className="mt-3 grid gap-x-4 gap-y-1.5 text-[11px] font-semibold sm:grid-cols-2"
            >
              {results.map(({ label, met }) => (
                <li
                  key={label}
                  className={`flex items-center gap-2 ${met ? 'text-success' : 'text-muted'}`}
                >
                  {met ? (
                    <CircleCheck className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Circle className="size-3.5" aria-hidden="true" />
                  )}
                  {label}
                  <span className="sr-only">{met ? '(met)' : '(not met)'}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 text-muted">
                <Circle className="size-3.5" aria-hidden="true" />
                Not previously used (checked on reset)
              </li>
            </ul>
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-confirm`} className={labelClass}>
            Confirm New Password
          </label>
          <Controller
            control={control}
            name="confirmPassword"
            rules={{ validate: () => matches }}
            render={({ field }) => (
              <PasswordInput
                id={`${id}-confirm`}
                name={field.name}
                icon={ShieldCheck}
                value={field.value}
                onChange={field.onChange}
                autoComplete="new-password"
                describedBy={`${id}-match`}
                invalid={mismatch}
              />
            )}
          />
          <p
            id={`${id}-match`}
            className="mt-2 flex min-h-4 items-center gap-1.5 text-[11px] font-semibold"
            aria-live="polite"
          >
            {matches && (
              <span className="flex items-center gap-1.5 text-success">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                Passphrases match perfectly
              </span>
            )}
            {mismatch && (
              <span className="flex items-center gap-1.5 text-red-600">
                <CircleAlert className="size-3.5" aria-hidden="true" />
                Passphrases do not match
              </span>
            )}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed font-medium text-ink">
          <input
            type="checkbox"
            {...register('signOutOthers')}
            className="mt-0.5 size-4 shrink-0 rounded accent-brand"
          />
          Sign out of all other laundry bay tablets, telemetry controllers, and
          route mobile scanners.
        </label>

        <button
          type="submit"
          disabled={!meetsPolicy || !matches || isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:bg-brand"
        >
          {isSubmitting ? 'Resetting…' : 'Reset Password & Sign In'}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold text-muted transition hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Cancel &amp; Return to Sign In
          </Link>
        </div>
      </form>

      

      <AuthFooter showAssistance={false} />
    </>
  )
}

export default ResetPasswordForm
