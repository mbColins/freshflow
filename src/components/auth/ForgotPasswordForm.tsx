import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  Headset,
  Mail,
  MailCheck,
  Phone,
} from 'lucide-react'
import { useForgotPasswordMutation } from '../../services/authApi'
import { errorMessage } from '../../utils/apiErrors'
import FormAlert from '../ui/FormAlert'
import AuthFooter from './AuthFooter'
import AuthHeader from './AuthHeader'

type ForgotPasswordValues = {
  email: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ForgotPasswordForm() {
  const id = useId()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ defaultValues: { email: '' } })
  const [forgotPassword, { error }] = useForgotPasswordMutation()
  // Deliberately vague: saying the account doesn't exist would let anyone
  // check which emails are registered
  const message = errorMessage(
    error,
    "We couldn't send a code to that email. Check the address and try again.",
  )

  async function onSubmit({ email }: ForgotPasswordValues) {
    try {
      // Stores the pending code for OtpForm (see authApi)
      await forgotPassword({ email: email.trim() }).unwrap()
      navigate('/verify', { state: { flow: 'recovery' } })
    } catch {
      // `error` drives the message above the field
    }
  }

  return (
    <>
      <AuthHeader
        title="Reset Your Password"
        subtitle="Commercial laundry OS account recovery"
      />

      <p className="mt-5 text-xs leading-relaxed text-muted">
        Enter your verified operator email  to receive a password reset otp.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-5 space-y-4"
      >
        {message && <FormAlert>{message}</FormAlert>}

        <div>
          <label
            htmlFor={`${id}-email`}
            className="text-xs font-semibold text-ink"
          >
            Email
          </label>
          <div className="relative mt-2">
            <Mail
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              placeholder="e.g. operator.name@freshflow.io"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={
                errors.email
                  ? `${id}-email-error ${id}-email-hint`
                  : `${id}-email-hint`
              }
              {...register('email', {
                validate: (value) =>
                  value.trim() === ''
                    ? 'Enter your email.'
                    : EMAIL_PATTERN.test(value.trim()) ||
                      'Enter a valid email address.',
              })}
              className="h-11 w-full rounded-md bg-field pr-3 pl-10 text-sm font-medium text-ink outline-none transition placeholder:font-normal placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-brand aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger"
            />
          </div>
          {errors.email && (
            <p
              id={`${id}-email-error`}
              className="mt-1.5 text-[11px] font-semibold text-danger"
            >
              {errors.email.message}
            </p>
          )}
          <p
            id={`${id}-email-hint`}
            className="mt-2 flex items-center gap-2 text-[11px] text-muted"
          >
            <MailCheck
              className="size-3.5 shrink-0 text-brand"
              aria-hidden="true"
            />
            You will recive and otp to the provided email address to reset your password.
           
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Sending…' : 'Send Reset Otp & Instructions'}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>

        <div className="flex items-center justify-between text-xs">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-sm font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Sign In
          </Link>
          <span className="text-muted">Step 1 of 3</span>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md bg-brand/5 px-3.5 py-3 ring-1 ring-brand/15">
        <Headset className="size-4 shrink-0 text-brand" aria-hidden="true" />
        <p className="min-w-40 flex-1 text-xs leading-relaxed text-ink">
          Need urgent on-premise override? Call Dispatch{' '}
          <span className="font-semibold text-brand">(Ext. 402)</span>
        </p>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-white px-3 text-[11px] font-semibold text-ink shadow-sm ring-1 ring-ink/5 transition hover:bg-brand/5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <Phone className="size-3.5" aria-hidden="true" />
          Call Ext
        </button>
      </div>

      <AuthFooter showAssistance={false} />
    </>
  )
}

export default ForgotPasswordForm
