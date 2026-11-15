import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[-0.02em] md:text-[32px]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function SectionHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h2 className="font-display text-[17px] font-bold">{title}</h2>
      {actions}
    </div>
  )
}
