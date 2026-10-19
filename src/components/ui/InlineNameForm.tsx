import { useForm, useWatch } from 'react-hook-form'
import { fieldClass, primaryButton } from '../orders/styles'

type InlineNameFormProps = {
  label: string
  placeholder: string
  // Extra reason to block saving (e.g. no filters to save)
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  submitLabel?: string
  onSave: (name: string) => void
}

// One-field "name it and save" form, used in menus for saved views, segments
// and categories
function InlineNameForm({
  label,
  placeholder,
  disabled = false,
  autoFocus,
  className = '',
  submitLabel = 'Save',
  onSave,
}: InlineNameFormProps) {
  const { register, handleSubmit, control } = useForm<{ name: string }>({
    defaultValues: { name: '' },
  })
  const name = useWatch({ control, name: 'name' })

  return (
    <form
      className={`flex gap-1 ${className}`}
      onSubmit={handleSubmit((values) => onSave(values.name.trim()))}
    >
      <input
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={placeholder}
        {...register('name', { validate: (value) => value.trim() !== '' })}
        className={`${fieldClass} h-8`}
      />
      <button
        type="submit"
        disabled={!name.trim() || disabled}
        className={`${primaryButton} h-8`}
      >
        {submitLabel}
      </button>
    </form>
  )
}

export default InlineNameForm
