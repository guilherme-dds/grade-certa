import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { currentPage } from '@/config/navigation'
import { cn } from '@/lib/cn'

interface SectionLayoutProps {
  /** Nome do grupo no menu lateral (ex.: Cadastros) */
  section: string
  /** Passo do fluxo "montar a grade", quando a seção faz parte dele */
  step?: number
  description?: ReactNode
}

/** Cabeçalho comum das telas de um grupo do menu: grupo e passo em cima, a tela atual como título. */
export function SectionLayout({ section, step, description }: SectionLayoutProps) {
  const { pathname } = useLocation()
  const { title } = currentPage(pathname)
  return (
    <>
      <header className="mb-5 print:hidden">
        <p className="mb-1 text-[13px] font-medium text-muted">{step ? `${section}, passo ${step} de 3` : section}</p>
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[-0.02em] md:text-[32px]">
          {title ?? section}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>}
      </header>

      <Outlet />
    </>
  )
}

export interface SubTab {
  to: string
  label: string
  end?: boolean
  /** Outros endereços em que a subaba aparece ativa */
  also?: string[]
}

/** Subabas dentro de uma tela (ex.: grade por turma, por professor e por sala) */
export function SubTabs({ tabs, label }: { tabs: SubTab[]; label: string }) {
  const { pathname } = useLocation()
  return (
    <>
      <nav
        aria-label={label}
        className="scrollbar-none mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-(--shadow-float) print:hidden"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            aria-current={tab.also?.includes(pathname) ? 'page' : undefined}
            className={({ isActive }) =>
              cn(
                'rounded-full px-4 py-2 text-[14px] font-medium whitespace-nowrap transition-colors',
                isActive || tab.also?.includes(pathname)
                  ? 'bg-ink font-semibold text-white'
                  : 'text-muted hover:bg-paper hover:text-ink',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}

/** Cabeçalho de uma aba: explica o que há nela e concentra as ações à direita. */
export function TabHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
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
