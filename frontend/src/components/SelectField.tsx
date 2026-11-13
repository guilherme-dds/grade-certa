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
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink/80">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          'h-11 w-full rounded-2xl border border-line bg-paper px-3.5 text-[14px] text-ink outline-none transition-colors hover:border-ink/20',
          'focus:border-ink focus:bg-white focus:ring-4 focus:ring-ink/8',
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
