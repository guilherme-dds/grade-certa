import { cn } from '@/lib/cn'

interface MultiSelectChipsProps {
  options: { value: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  /** Texto do seletor para adicionar mais um */
  addLabel: string
  emptyLabel?: string
  className?: string
}

/** Lista de escolhidos (com remover) + seletor para adicionar mais um. */
export function MultiSelectChips({ options, value, onChange, addLabel, emptyLabel, className }: MultiSelectChipsProps) {
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v
  const remaining = options.filter((o) => !value.includes(o.value))

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {value.length === 0 && emptyLabel && <span className="text-[11px] text-muted">{emptyLabel}</span>}
      {value.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded border border-primary-soft-line bg-primary-soft/50 py-0.5 pr-1 pl-2 text-xs font-medium text-ink"
        >
          {labelOf(v)}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            aria-label={`Remover ${labelOf(v)}`}
            className="rounded px-1 text-muted hover:bg-danger-soft hover:text-danger"
          >
            ×
          </button>
        </span>
      ))}
      {remaining.length > 0 && (
        <select
          value=""
          aria-label={addLabel}
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
          className="max-w-full min-w-0 flex-1 rounded border border-dashed border-line bg-white px-2 py-1 text-xs text-muted outline-none focus:border-primary"
        >
          <option value="">{addLabel}</option>
          {remaining.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
