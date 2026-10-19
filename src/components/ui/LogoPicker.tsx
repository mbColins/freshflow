import { useRef } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { LOGO_MAX_BYTES, LOGO_TYPES } from '../../constants/tenants'
import FormField from './FormField'

type LogoPickerProps = {
  id: string
  label?: string
  // Image to show: the chosen file's preview or the saved logo
  preview: string | null
  // The newly chosen file, if any
  file: File | null
  error?: string | null
  onChoose: (file: File) => void
  // Clears the chosen file, or the saved logo when there is no new file
  onRemove: () => void
}

// A square placeholder that opens the file picker and previews the logo
function LogoPicker({ id, label = 'Logo (optional)', preview, file, error, onChoose, onRemove }: LogoPickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const action = preview ? 'Change logo' : 'Upload logo'

  return (
    <FormField
      label={label}
      htmlFor={id}
      error={error ?? undefined}
      hint={`PNG, JPEG or WebP, up to ${LOGO_MAX_BYTES / 1024 / 1024} MB`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={action}
          title={action}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-field ring-1 ring-line transition hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger"
        >
          {preview ? (
            <img src={preview} alt="" className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-5 text-muted" aria-hidden="true" />
          )}
        </button>
        {/* Native picker kept for the file dialog only */}
        <input
          ref={input}
          id={id}
          type="file"
          tabIndex={-1}
          accept={LOGO_TYPES.join(',')}
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            // Cleared so picking the same file again still fires onChange
            event.target.value = ''
            if (chosen) onChoose(chosen)
          }}
          className="sr-only"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-muted">
            {file
              ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`
              : preview
                ? 'Current logo'
                : 'Click the square to add a logo'}
          </p>
          {preview && (
            <button
              type="button"
              onClick={onRemove}
              className="mt-1 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-muted transition hover:bg-field hover:text-danger focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
      </div>
    </FormField>
  )
}

export default LogoPicker
