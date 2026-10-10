const buttonBase =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export const primaryButton = `${buttonBase} bg-brand font-bold text-white hover:bg-brand-dark focus-visible:ring-offset-2`
export const secondaryButton = `${buttonBase} bg-white font-semibold text-ink ring-1 ring-line hover:bg-field`
export const dangerButton = `${buttonBase} bg-danger font-bold text-white hover:bg-danger/90 focus-visible:ring-offset-2`

export const fieldClass =
  'h-9 w-full rounded-md bg-field px-3 text-xs font-medium text-ink outline-none transition placeholder:font-normal placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-brand'
export const labelClass = 'mb-1 block text-[11px] font-semibold text-ink'
export const iconButton =
  'flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none'
export const sectionTitle =
  'text-[10px] font-bold tracking-wider text-muted uppercase'
