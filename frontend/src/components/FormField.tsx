import { useId, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'

interface FormFieldProps extends ComponentProps<'input'> {
  label: string
  error?: string
}

export function FormField({ label, error, className, ...inputProps }: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors',
          'focus:border-primary focus:ring-1 focus:ring-primary',
          error && 'border-danger focus:border-danger focus:ring-danger',
          className,
        )}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
