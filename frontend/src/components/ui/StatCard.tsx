import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

const tones = {
  default: 'text-ink',
  success: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger',
}

const dots = {
  default: 'bg-line',
  success: 'bg-accent',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

const sizes = {
  lg: 'text-[30px]',
  md: 'text-[20px]',
  sm: 'text-[17px]',
}

interface StatCardProps {
  label: string
  value: ReactNode
  /** Texto menor abaixo do valor, ex.: "de 42 professores" */
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
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
          <span className={cn('size-2 rounded-full', dots[tone])} aria-hidden="true" />
          {label}
        </p>
        {to && (
          <span
            className="grid size-7 place-items-center rounded-full bg-paper text-muted transition-colors group-hover:bg-ink group-hover:text-white"
            aria-hidden="true"
          >
            <Icon name="arrowUpRight" width={14} height={14} />
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="mt-4 h-8 w-28 animate-pulse rounded-lg bg-line-soft" />
      ) : (
        <div className="mt-3">
          <p className={cn('truncate font-display leading-tight font-bold tabular-nums', tones[tone], sizes[size])}>
            {value}
          </p>
          {suffix && <p className="mt-0.5 truncate text-[13px] text-muted">{suffix}</p>}
        </div>
      )}
    </>
  )

  if (to) {
    return (
      <Link to={to} className="group card block p-5 transition-shadow hover:shadow-[0_12px_32px_-16px_rgb(21_22_26/0.3)]">
        {inner}
      </Link>
    )
  }

  return <div className="card p-5">{inner}</div>
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">{children}</div>
}
