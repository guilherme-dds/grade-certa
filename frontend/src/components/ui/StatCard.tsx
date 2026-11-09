import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'

const tones = {
  default: 'text-ink',
  success: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger',
}

const sizes = {
  lg: 'text-[26px]',
  md: 'text-lg',
  sm: 'text-base',
}

interface StatCardProps {
  label: string
  value: ReactNode
  /** Texto menor ao lado do valor, ex.: "de 42 professores" */
  suffix?: string
  tone?: keyof typeof tones
  size?: keyof typeof sizes
  to?: string
  isLoading?: boolean
}

export function StatCard({
  label,
  value,
  suffix,
  tone = 'default',
  size = 'lg',
  to,
  isLoading,
}: StatCardProps) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        {to && (
          <span className="text-[11px] text-primary/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
            →
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="mt-2.5 h-7 w-28 animate-pulse rounded bg-line-soft" />
      ) : (
        <p className={cn('mt-1.5 font-bold', tones[tone], sizes[size])}>
          {value}
          {suffix && <span className="ml-1 text-sm font-normal text-muted">{suffix}</span>}
        </p>
      )}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="group block rounded-lg border border-line bg-white p-[18px] transition hover:border-primary/50 hover:shadow-xs"
      >
        {inner}
      </Link>
    )
  }

  return <div className="rounded-lg border border-line bg-white p-[18px]">{inner}</div>
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">{children}</div>
}
