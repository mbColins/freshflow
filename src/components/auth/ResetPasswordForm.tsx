import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import AuthFooter from './AuthFooter'
import AuthHeader from './AuthHeader'
import PasswordInput from './PasswordInput'

const CRITERIA = [
  { label: '10+ characters', test: (value: string) => value.length >= 10 },
  {
    label: 'Uppercase & lowercase',
    test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  },
  {
    label: 'At least 1 number or symbol',
    test: (value: string) => /[\d\W_]/.test(value),
  },
]

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
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [signOutOthers, setSignOutOthers] = useState(true)

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // TODO: send { password, signOutOthers } to the auth API and only continue on success
    navigate('/login', { replace: true, state: { passwordReset: true } })
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

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
          <PasswordInput
            id={`${id}-password`}
            name="new-password"
            icon={Lock}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            describedBy={`${id}-criteria`}
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
          <PasswordInput
            id={`${id}-confirm`}
            name="confirm-password"
            icon={ShieldCheck}
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            describedBy={`${id}-match`}
            invalid={mismatch}
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
            name="sign-out-others"
            checked={signOutOthers}
            onChange={(event) => setSignOutOthers(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded accent-brand"
          />
          Sign out of all other laundry bay tablets, telemetry controllers, and
          route mobile scanners.
        </label>

        <button
          type="submit"
          disabled={!meetsPolicy || !matches}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:bg-brand"
        >
          Reset Password &amp; Sign In
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
