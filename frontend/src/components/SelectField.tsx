import { useId, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'

interface SelectFieldProps extends ComponentProps<'select'> {
  label: string
  /** Texto simples (valor = rótulo) ou par valor/rótulo */
  options: readonly (string | { value: string; label: string })[]
}

export function SelectField({ label, options, className, ...selectProps }: SelectFieldProps) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          'w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors',
          'focus:border-primary focus:ring-1 focus:ring-primary',
          className,
        )}
        {...selectProps}
      >
        {options.map((option) => {
          const { value, label: optionLabel } = typeof option === 'string' ? { value: option, label: option } : option
          return (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          )
        })}
      </select>
    </div>
  )
}
