import type { ReactNode } from 'react'

type AuthShellProps = {
  panel: ReactNode
  children: ReactNode
}

function AuthShell({ panel, children }: AuthShellProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-canvas p-4 antialiased sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 shadow-ink/5 ring-ink/5 lg:min-h-[620px] lg:grid-cols-[5fr_7fr]">
        {panel}
        <section className="flex flex-col justify-center px-6 py-8 sm:px-10">
          {children}
        </section>
      </div>
    </main>
  )
}

export default AuthShell
