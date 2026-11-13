import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/cn'

export interface SectionTab {
  to: string
  label: string
  /** Número ao lado do rótulo (ex.: conflitos pendentes) */
  count?: number
  countTone?: 'neutral' | 'danger'
  end?: boolean
}

interface SectionLayoutProps {
  title: string
  description?: ReactNode
  /** Passo do fluxo "montar a grade", quando a seção faz parte dele */
  step?: number
  tabs: SectionTab[]
  actions?: ReactNode
}

/** Título da seção + abas em pílula; cada aba é uma rota filha. */
export function SectionLayout({ title, description, step, tabs, actions }: SectionLayoutProps) {
  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {step && <p className="mb-1 text-[13px] font-medium text-muted">Passo {step} de 3</p>}
          <h1 className="font-display text-[28px] leading-tight font-bold tracking-[-0.02em] md:text-[32px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
      </header>

      <SectionTabs tabs={tabs} label={title} />

      <Outlet />
    </>
  )
}

export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-(--shadow-float) print:hidden"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium whitespace-nowrap transition-colors',
              isActive ? 'bg-ink font-semibold text-white' : 'text-muted hover:bg-paper hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[11.5px] font-semibold tabular-nums',
                    tab.countTone === 'danger'
                      ? 'bg-danger text-white'
                      : isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-paper text-muted',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** Cabeçalho de uma aba: explica o que há nela e concentra as ações à direita. */
export function TabHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="sr-only">{title}</h2>
        {description && <p className="max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  )
}
