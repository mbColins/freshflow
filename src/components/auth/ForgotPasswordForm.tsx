import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  Headset,
  Mail,
  MailCheck,
  Phone,
} from 'lucide-react'
import AuthFooter from './AuthFooter'
import AuthHeader from './AuthHeader'

function ForgotPasswordForm() {
  const id = useId()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // TODO: send { email } to the auth API to dispatch the reset OTP
    navigate('/verify', { state: { flow: 'recovery' } })
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

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
  

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
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="e.g. operator.name@freshflow.io"
              aria-describedby={`${id}-email-hint`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-md bg-field pr-3 pl-10 text-sm font-medium text-ink outline-none transition placeholder:font-normal placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-brand"
            />
          </div>
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
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Send Reset Otp &amp; Instructions
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
