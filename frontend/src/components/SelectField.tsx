import { useId } from 'react'
import { Select } from '@/components/ui/Select'

interface SelectFieldProps {
  label: string
  /** Texto simples (valor = rótulo) ou par valor/rótulo */
  options: readonly (string | { value: string; label: string })[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

/** Rótulo acima + seletor da plataforma, no mesmo estilo dos campos de texto */
export function SelectField({ label, options, value, onChange, disabled, className }: SelectFieldProps) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink/80">
        {label}
      </label>
      <Select
        id={id}
        label={label}
        variant="field"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={className}
        options={options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))}
      />
    </div>
  )
}
