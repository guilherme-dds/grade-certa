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
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink/80">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-11 w-full rounded-2xl border border-line bg-paper px-3.5 text-[14px] text-ink outline-none transition-colors hover:border-ink/20',
          'focus:border-ink focus:bg-white focus:ring-4 focus:ring-ink/8',
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
