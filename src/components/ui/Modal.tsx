import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

const VARIANT_CLASSES = {
  sm: 'm-auto max-h-[90vh] max-w-sm rounded-xl',
  md: 'm-auto max-h-[90vh] max-w-lg rounded-xl max-sm:m-0 max-sm:h-full max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none',
  lg: 'm-auto max-h-[90vh] max-w-3xl rounded-xl max-sm:m-0 max-sm:h-full max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none',
  xl: 'm-auto max-h-[90vh] max-w-4xl rounded-xl max-sm:m-0 max-sm:h-full max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none',
  drawer: 'm-0 ml-auto h-full max-h-none max-w-xl',
}

type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  variant?: keyof typeof VARIANT_CLASSES
  footer?: ReactNode
  children: ReactNode
}

function Modal({
  open,
  onClose,
  title,
  subtitle,
  variant = 'md',
  footer,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={`w-full flex-col overflow-hidden bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40 open:flex ${VARIANT_CLASSES[variant]}`}
    >
      {open && (
        <>
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold">{title}</h2>
              {subtitle && (
                <div className="mt-0.5 text-[11px] text-muted">{subtitle}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
          {footer && (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  )
}

export default Modal
