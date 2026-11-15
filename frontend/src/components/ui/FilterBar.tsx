import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Select } from './Select'

export interface QuickFilter {
  value: string
  label: string
  count: number
  /** Destaca a contagem quando o filtro aponta uma pendência */
  attention?: boolean
}

/** Filtros rápidos com contagem: os números da lista viram atalhos para ela. */
export function QuickFilters({
  filters,
  value,
  onChange,
  label,
}: {
  filters: QuickFilter[]
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {filters.map((f) => {
        const active = f.value === value
        return (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(f.value)}
            className={cn(
              'flex h-9 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition-colors',
              active ? 'bg-ink text-white' : 'bg-white text-ink shadow-(--shadow-float) hover:bg-paper',
            )}
          >
            {f.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-[12px] font-semibold tabular-nums',
                active
                  ? 'bg-white/20 text-white'
                  : f.attention && f.count > 0
                    ? 'bg-warning-soft text-warning'
                    : 'bg-paper text-muted',
              )}
            >
              {f.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Busca compacta com ícone, sem rótulo visível (o rótulo fica para leitores de tela). */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return (
    <label className="relative flex min-w-[220px] flex-1">
      <span className="sr-only">{label}</span>
      <svg
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-full border border-line bg-white pr-4 pl-10 text-[14px] outline-none transition-colors placeholder:text-muted/70 focus:border-ink"
      />
    </label>
  )
}

/** Seletor compacto em pílula: "Nível: Todos". */
export function CompactSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select
      label={label}
      prefix
      value={value}
      onChange={onChange}
      options={options}
      className="max-w-64"
      menuMinWidth={220}
    />
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>
}
