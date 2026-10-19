import { useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Phone,
  Smartphone,
} from 'lucide-react'
import useNow from '../../hooks/useNow'
import { getSettings } from '../../hooks/useSettings'
import {
  useResendOtpMutation,
  useValidateOtpMutation,
} from '../../services/authApi'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  selectVerification,
  setResetCode,
  setVerification,
} from '../../store/slices/authSlice'
import { needsNewPassword } from '../../types/auth'
import { errorMessage, NETWORK_ERROR_MESSAGE } from '../../utils/apiErrors'
import FormAlert from '../ui/FormAlert'
import AuthFooter from './AuthFooter'
import AuthHeader from './AuthHeader'

const OTP_LENGTH = 6
const EMPTY_DIGITS = Array<string>(OTP_LENGTH).fill('')

type OtpFormValues = {
  digits: string[]
}

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
  // Set by ForgotPasswordForm; absent when arriving from login. Still read when
  // the pending code is gone, to send the user back to the right step
  const isRecovery = location.state?.flow === 'recovery'
  const dispatch = useAppDispatch()
  // Set by login or forgot password; lost on page reload
  const verification = useAppSelector(selectVerification)
  // Set once the code is accepted, so clearing `verification` doesn't trip the
  // redirect below while the navigation (a React transition) is still pending
  const [verified, setVerified] = useState(false)
  // Validation succeeded but returned no uuid for the set-password step
  const [missingResetUuid, setMissingResetUuid] = useState(false)
  const now = useNow(1000)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<OtpFormValues>({ defaultValues: { digits: EMPTY_DIGITS } })
  const digits = useWatch({ control, name: 'digits' })
  const [validateOtp, { error: validateError, reset: resetValidate }] =
    useValidateOtpMutation()
  const [resendOtp, { error: resendError, isLoading: resending }] =
    useResendOtpMutation()

  const expiresAt = verification?.expiresAt ?? 0
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  const expired = secondsLeft === 0
  const complete = digits.every((digit) => digit !== '')
  const message =
    errorMessage(validateError, 'That code is incorrect or has expired.') ??
    (resendError ? NETWORK_ERROR_MESSAGE : null) ??
    (missingResetUuid
      ? 'Code accepted, but the server did not return a reset reference. Request a new code.'
      : null)

  function focusInput(index: number) {
    const clamped = Math.min(Math.max(index, 0), OTP_LENGTH - 1)
    inputsRef.current[clamped]?.focus()
  }

  async function handleResend() {
    reset({ digits: EMPTY_DIGITS })
    resetValidate()
    setMissingResetUuid(false)
    focusInput(0)
    if (!verification) return
    try {
      // Restarts the countdown on success (see authApi)
      await resendOtp(verification.uuid).unwrap()
    } catch {
      // `resendError` drives the message above the code
    }
  }

  async function onSubmit({ digits }: OtpFormValues) {
    if (!verification) return
    // Forgot password: the backend checks the code together with the new
    // password, and validating it here first would use it up
    if (verification.role === 'FORGOT_PASSWORD') {
      dispatch(setResetCode(digits.join('')))
      navigate('/reset-password', { replace: true })
      return
    }
    try {
      const result = await validateOtp({
        uuid: verification.uuid,
        otp: digits.join(''),
        otpRole: verification.role,
      }).unwrap()
      // STEP_THREE: set a password with the uuid and token it returns
      // (authApi stores them); STEP_TWO: authApi stored the session
      if (needsNewPassword(result)) {
        // Without the uuid the set-password page would only bounce back
        if (!result.uuid) {
          setMissingResetUuid(true)
          return
        }
        navigate('/reset-password', { replace: true })
      } else {
        setVerified(true)
        dispatch(setVerification(null))
        navigate(getSettings().startPage, { replace: true })
      }
    } catch {
      // `validateError` drives the message above the code
    }
  }

  // No pending code (e.g. after a reload): start the flow over
  if (!verification) {
    if (verified) return null
    return <Navigate to={isRecovery ? '/forgot-password' : '/login'} replace />
  }

  return (
    <>
      <AuthHeader
        title="Verify your identity"
        subtitle="Two-factor authentication for this terminal session"
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 space-y-4"
      >
        <div className="flex items-start gap-3 rounded-md bg-brand/5 px-3.5 py-3 ring-1 ring-brand/15">
          <Smartphone
            className="mt-0.5 size-4 shrink-0 text-brand"
            aria-hidden="true"
          />
          <p className="flex-1 text-xs leading-relaxed text-muted">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-ink">{verification.email}</span>
            , enter it to verify your identity
          </p>
        </div>

        {message && <FormAlert>{message}</FormAlert>}

        <Controller
          control={control}
          name="digits"
          rules={{ validate: (value) => value.every((digit) => digit !== '') }}
          render={({ field }) => {
            const setDigit = (index: number, digit: string) =>
              field.onChange(field.value.map((d, i) => (i === index ? digit : d)))

            function handleChange(index: number, value: string) {
              const digit = value.replace(/\D/g, '').slice(-1)
              setDigit(index, digit)
              if (digit) focusInput(index + 1)
            }

            function handleKeyDown(
              index: number,
              event: KeyboardEvent<HTMLInputElement>,
            ) {
              if (event.key === 'Backspace' && !field.value[index] && index > 0) {
                setDigit(index - 1, '')
                focusInput(index - 1)
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault()
                focusInput(index - 1)
              } else if (event.key === 'ArrowRight') {
                event.preventDefault()
                focusInput(index + 1)
              }
            }

            function handlePaste(
              index: number,
              event: ClipboardEvent<HTMLInputElement>,
            ) {
              event.preventDefault()
              const pasted = event.clipboardData
                .getData('text')
                .replace(/\D/g, '')
                .slice(0, OTP_LENGTH - index)
              if (!pasted) return
              field.onChange(
                field.value.map((d, i) =>
                  i >= index && i < index + pasted.length ? pasted[i - index] : d,
                ),
              )
              focusInput(index + pasted.length)
            }

            return (
              <fieldset>
                <legend className="text-xs font-semibold text-ink">
                  Enter 6-Digit Verification Code
                </legend>
                <div className="mt-2 grid grid-cols-6 gap-2 sm:gap-3">
                  {field.value.map((digit, index) => (
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
                      onBlur={field.onBlur}
                      className={`h-14 w-full rounded-md bg-field text-center text-xl font-bold text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-brand ${
                        digit ? 'ring-1 ring-accent/60' : ''
                      }`}
                    />
                  ))}
                </div>
              </fieldset>
            )
          }}
        />

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
              disabled={resending}
              className={`inline-flex items-center gap-1.5 disabled:opacity-50 ${linkClass}`}
            >
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {resending ? 'Sending…' : 'Resend otp'}
            </button>
            {/* TODO: no voice-call endpoint yet; this resends by email */}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className={`inline-flex items-center gap-1.5 disabled:opacity-50 ${linkClass}`}
            >
              <Phone className="size-3.5" aria-hidden="true" />
              Voice Call
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!complete || expired || isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:bg-brand"
        >
          {isSubmitting ? 'Verifying…' : 'Verify & Continue'}
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
