import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Phone,
  Smartphone,
} from 'lucide-react'
import { getSettings } from '../../hooks/useSettings'
import AuthFooter from './AuthFooter'
import AuthHeader from './AuthHeader'

const OTP_LENGTH = 6
const CODE_TTL_SECONDS = 162

const linkClass =
  'rounded-sm font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'

function formatTime(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function OtpForm() {
  const navigate = useNavigate()
  const location = useLocation()
  // Set by ForgotPasswordForm; absent when arriving from login
  const isRecovery = location.state?.flow === 'recovery'
  const [digits, setDigits] = useState<string[]>(() =>
    Array(OTP_LENGTH).fill(''),
  )
  const [secondsLeft, setSecondsLeft] = useState(CODE_TTL_SECONDS)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const expired = secondsLeft === 0
  const complete = digits.every((digit) => digit !== '')

  useEffect(() => {
    if (expired) return
    const timer = setInterval(
      () => setSecondsLeft((seconds) => Math.max(0, seconds - 1)),
      1000,
    )
    return () => clearInterval(timer)
  }, [expired])

  function focusInput(index: number) {
    const clamped = Math.min(Math.max(index, 0), OTP_LENGTH - 1)
    inputsRef.current[clamped]?.focus()
  }

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    setDigits((current) => current.map((d, i) => (i === index ? digit : d)))
    if (digit) focusInput(index + 1)
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      setDigits((current) => current.map((d, i) => (i === index - 1 ? '' : d)))
      focusInput(index - 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusInput(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusInput(index + 1)
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH - index)
    if (!pasted) return
    setDigits((current) =>
      current.map((d, i) =>
        i >= index && i < index + pasted.length ? pasted[i - index] : d,
      ),
    )
    focusInput(index + pasted.length)
  }

  function handleResend() {
    // TODO: request a new code from the auth API (SMS or voice call)
    setDigits(Array(OTP_LENGTH).fill(''))
    setSecondsLeft(CODE_TTL_SECONDS)
    focusInput(0)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // TODO: send digits.join('') to the auth API and only continue if it is valid
    navigate(isRecovery ? '/reset-password' : getSettings().startPage, { replace: true })
  }

  return (
    <>
      <AuthHeader
        title="Verify your identity"
        subtitle="Two-factor authentication for this terminal session"
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="flex items-start gap-3 rounded-md bg-brand/5 px-3.5 py-3 ring-1 ring-brand/15">
          <Smartphone
            className="mt-0.5 size-4 shrink-0 text-brand"
            aria-hidden="true"
          />
          <p className="flex-1 text-xs leading-relaxed text-muted">
            We sent a 6-digit code to your registered email, enter it to verify your identity
          </p>
        </div>

        <fieldset>
          <legend className="text-xs font-semibold text-ink">
            Enter 6-Digit Verification Code
          </legend>
          <div className="mt-2 grid grid-cols-6 gap-2 sm:gap-3">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputsRef.current[index] = element
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                autoFocus={index === 0}
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={(event) => handlePaste(index, event)}
                onFocus={(event) => event.target.select()}
                className={`h-14 w-full rounded-md bg-field text-center text-xl font-bold text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-brand ${digit ? 'ring-1 ring-accent/60' : ''
                  }`}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-muted" role="timer">
            {expired ? (
              <span className="font-semibold text-ink">
                Code expired — request a new one
              </span>
            ) : (
              <>
                Code expires in{' '}
                <span className="font-bold text-ink tabular-nums">
                  {formatTime(secondsLeft)}
                </span>
              </>
            )}
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleResend}
              className={`inline-flex items-center gap-1.5 ${linkClass}`}
            >
              <MessageSquare className="size-3.5" aria-hidden="true" />
              Resend otp
            </button>
            <button
              type="button"
              onClick={handleResend}
              className={`inline-flex items-center gap-1.5 ${linkClass}`}
            >
              <Phone className="size-3.5" aria-hidden="true" />
              Voice Call
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!complete || expired}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:bg-brand"
        >
          Verify &amp; Continue
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>




        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <Link
            to={isRecovery ? '/forgot-password' : '/login'}
            className={`inline-flex items-center gap-1.5 ${linkClass}`}
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {isRecovery ? 'Back to account recovery' : 'Back to login'}
          </Link>
        </div>
      </form>

      <AuthFooter />
    </>
  )
}

export default OtpForm
