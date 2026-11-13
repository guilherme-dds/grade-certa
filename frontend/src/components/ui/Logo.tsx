import { cn } from '@/lib/cn'

/** Marca: uma grade 3×3 com a célula central "no lugar certo". */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="9" fill={inverted ? '#fff' : '#15161A'} />
      <g fill={inverted ? '#15161A' : '#fff'} fillOpacity=".28">
        <rect x="7" y="7" width="5" height="5" rx="1.5" />
        <rect x="13.5" y="7" width="5" height="5" rx="1.5" />
        <rect x="20" y="7" width="5" height="5" rx="1.5" />
        <rect x="7" y="13.5" width="5" height="5" rx="1.5" />
        <rect x="20" y="13.5" width="5" height="5" rx="1.5" />
        <rect x="7" y="20" width="5" height="5" rx="1.5" />
        <rect x="13.5" y="20" width="5" height="5" rx="1.5" />
        <rect x="20" y="20" width="5" height="5" rx="1.5" />
      </g>
      <rect x="13.5" y="13.5" width="5" height="5" rx="1.5" fill={inverted ? '#0B7F63' : '#3FD1A6'} />
    </svg>
  )
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark inverted={inverted} />
      <span
        className={cn(
          'font-display text-[19px] font-bold tracking-[-0.02em]',
          inverted ? 'text-white' : 'text-ink',
        )}
      >
        GradeCerta
      </span>
    </span>
  )
}
