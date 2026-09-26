import type { ReactNode } from 'react'
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
}

export function StatCard({ label, value, suffix, tone = 'default', size = 'lg' }: StatCardProps) {
  return (
    <div className="rounded-lg border border-line bg-white p-[18px]">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('mt-1.5 font-bold', tones[tone], sizes[size])}>
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-muted">{suffix}</span>}
      </p>
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">{children}</div>
}
