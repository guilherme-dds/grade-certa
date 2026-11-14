import { cn } from '@/lib/cn'

/**
 * Marca: o "G" de Grade, traçado como giz, fecha num ✓ (a grade certa).
 * Versão invertida (fundo escuro): azulejo branco, traço em tinta e ✓ no verde principal.
 */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="9" fill={inverted ? '#fff' : '#15161A'} />
      <path
        d="M22.4 9.6A8.6 8.6 0 1 0 24.6 17.6"
        stroke={inverted ? '#15161A' : '#fff'}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M13.2 16.4 16 19.2 22.6 12.6"
        stroke={inverted ? '#0B7F63' : '#3FD1A6'}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark inverted={inverted} />
      <span
        className={cn(
          'font-display text-[20px] font-extrabold tracking-[-0.03em]',
          inverted ? 'text-white' : 'text-ink',
        )}
      >
        Grade Certa
      </span>
    </span>
  )
}
