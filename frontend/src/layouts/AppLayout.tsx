import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { getDisciplinas } from '@/api/disciplinas'
import { getHistoricoGrades } from '@/api/grades'
import { getProfessores } from '@/api/professores'
import { getSalas } from '@/api/salas'
import { getTurmas } from '@/api/turmas'
import { useAuth } from '@/auth/useAuth'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ToastProvider } from '@/components/ui/Toast'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'
import {
  currentPage,
  isNavItemActive,
  navGroups,
  settingsGroup,
  type NavBadge,
  type NavGroup,
  type NavItem,
} from '@/config/navigation'
import { paths } from '@/config/paths'
import { cn } from '@/lib/cn'
import { ScheduleProvider } from '@/schedule/ScheduleProvider'
import { useSchedule } from '@/schedule/useSchedule'
import { useWorkflow } from '@/schedule/useWorkflow'

export function AppLayout() {
  return (
    <ConfirmProvider>
      <ToastProvider>
        <ScheduleProvider>
          <Shell />
        </ScheduleProvider>
      </ToastProvider>
    </ConfirmProvider>
  )
}

function Shell() {
  const { pathname } = useLocation()
  // A gaveta fica aberta só na página em que foi aberta: trocar de página a fecha
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const menuOpen = menuPath === pathname
  const setMenuOpen = (open: boolean) => setMenuPath(open ? pathname : null)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen])

  return (
    <div className="flex min-h-svh gap-4 p-0 md:p-4 print:block print:p-0">
      {/* Desktop: sidebar flutuante */}
      <aside className="sticky top-4 hidden h-[calc(100svh-2rem)] w-[248px] shrink-0 lg:block print:hidden">
        <Sidebar />
      </aside>

      {/* Mobile/tablet: gaveta */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 animate-[fade-in_200ms_ease-out] bg-ink/40 backdrop-blur-[2px]"
          />
          <div className="relative h-full w-[272px] animate-[drawer-in_260ms_cubic-bezier(0.2,0.8,0.2,1)] p-3">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
        <main className="min-w-0 flex-1 px-4 pt-5 pb-12 md:px-2 md:pt-4 print:p-0">
          {/* A troca de tela entra com um leve fade; trocar só os filtros (?turma=) não repete o efeito */}
          <div key={pathname} className="animate-[page-in_220ms_ease-out] print:animate-none">
            <Outlet />
          </div>
        </main>
        <ScrollRestoration />
      </div>
    </div>
  )
}

function Sidebar() {
  const { user, logout } = useAuth()
  const { conflicts } = useSchedule()
  const { turmasSemMatriz, docentesSemDisponibilidade } = useWorkflow()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const hasUser = Boolean(user)

  // Um único fundo escuro desliza até o item ativo, em vez de cada item acender sozinho
  useLayoutEffect(() => {
    const nav = navRef.current
    const pill = pillRef.current
    if (!nav || !pill) return
    let first = !pill.dataset.ready
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('a[data-nav-item][aria-current="page"]')
      if (!active || nav.clientHeight === 0) {
        pill.style.opacity = '0'
        return
      }
      const top = active.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop
      // Na primeira medida o fundo aparece já no lugar, sem deslizar a partir do topo
      pill.style.transitionProperty = first ? 'none' : 'transform, height, opacity'
      pill.style.transform = `translateY(${top}px)`
      pill.style.height = `${active.offsetHeight}px`
      pill.style.opacity = '1'
      pill.dataset.ready = 'true'
      first = false
    }
    measure()
    // Fontes carregando ou a janela mudando de tamanho: reposiciona (sem animar se nada mudou)
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    if (nav.firstElementChild) observer.observe(nav.firstElementChild)
    return () => observer.disconnect()
  }, [pathname, hasUser])

  if (!user) return null

  const badges: Record<NavBadge, number> = {
    conflitos: conflicts.length,
    semMatriz: turmasSemMatriz.length,
    semDisponibilidade: docentesSemDisponibilidade.length,
  }

  return (
    <nav
      ref={navRef}
      aria-label="Principal"
      className="card scrollbar-none relative flex h-full flex-col overflow-y-auto px-3 pt-5 pb-3"
    >
      <div
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-3 left-3 rounded-full bg-ink opacity-0 shadow-[0_6px_16px_-8px_rgb(21_22_26/0.6)] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      />
      <Link to={paths.home} className="mx-3 mb-4 rounded-lg">
        <Logo />
      </Link>

      <div className="flex flex-col gap-3.5">
        {navGroups.map((group, gi) => (
          <SidebarGroup key={group.label ?? gi} group={group} badges={badges} />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-3">
        <SidebarGroup group={settingsGroup} badges={badges} />
        <div className="flex items-center gap-3 rounded-2xl bg-paper p-2.5">
          <Avatar name={user.name} />
          <Link to={paths.conta} className="min-w-0 flex-1 rounded-md hover:underline">
            <p className="truncate text-[13.5px] font-semibold">{user.name}</p>
            <p className="truncate text-[12px] text-muted">{user.email}</p>
          </Link>
          <button
            type="button"
            onClick={logout}
            aria-label="Sair"
            title="Sair"
            className="rounded-full p-2 text-muted transition-colors hover:bg-white hover:text-danger"
          >
            <Icon name="logout" width={16} height={16} />
          </button>
        </div>
      </div>
    </nav>
  )
}

const BADGE_HINT: Record<NavBadge, string> = {
  conflitos: 'conflitos',
  semMatriz: 'sem matriz',
  semDisponibilidade: 'sem disponibilidade',
}

function SidebarGroup({ group, badges }: { group: NavGroup; badges: Record<NavBadge, number> }) {
  const id = group.label ? `menu-${group.label.toLowerCase().replace(/\s+/g, '-')}` : undefined
  return (
    <div>
      {group.label && (
        <p id={id} className="mb-1 px-3 text-[12px] font-semibold text-muted">
          {group.label}
        </p>
      )}
      <ul aria-labelledby={id} className="flex flex-col gap-px">
        {group.items.map((item) => (
          <li key={item.to}>
            <SidebarLink
              item={item}
              badge={item.badge ? badges[item.badge] : 0}
              badgeHint={item.badge && BADGE_HINT[item.badge]}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

const q = {
  professores: { queryKey: ['professores'], queryFn: () => getProfessores() },
  turmas: { queryKey: ['turmas'], queryFn: () => getTurmas() },
  disciplinas: { queryKey: ['disciplinas'], queryFn: () => getDisciplinas() },
  salas: { queryKey: ['salas'], queryFn: () => getSalas() },
  historico: { queryKey: ['historicoGrades'], queryFn: () => getHistoricoGrades() },
}

const PREFETCH: Record<string, { queryKey: string[]; queryFn: () => Promise<unknown> }[]> = {
  [paths.professores]: [q.professores, q.disciplinas],
  [paths.turmas]: [q.turmas, q.professores, q.disciplinas],
  [paths.disciplinas]: [q.disciplinas],
  [paths.salas]: [q.salas],
  [paths.geracao]: [q.historico, q.turmas, q.professores],
  [paths.geracaoRegras]: [q.turmas, q.professores],
  [paths.geracaoHistorico]: [q.historico],
  [paths.grade]: [q.historico],
  [paths.resumo]: [q.historico, q.professores, q.salas],
  [paths.escola]: [q.professores],
}

function SidebarLink({ item, badge = 0, badgeHint }: { item: NavItem; badge?: number; badgeHint?: string }) {
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const isActive = isNavItemActive(item, pathname)
  // Busca os dados da tela ao apontar para o item, para ela abrir já preenchida
  const prefetch = () => {
    for (const q of PREFETCH[item.to] ?? []) queryClient.prefetchQuery({ ...q, staleTime: 30_000 })
  }
  return (
    <Link
      to={item.to}
      data-nav-item
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className={cn(
        'group relative flex items-center gap-3 rounded-full px-3 py-[7px] text-[14px] transition-colors duration-200',
        isActive ? 'font-semibold text-white' : 'text-muted hover:bg-paper hover:text-ink',
      )}
    >
      <Icon name={item.icon} width={17} height={17} className="shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {badge > 0 && (
        <span
          className={cn(
            'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-none font-semibold tabular-nums',
            item.badge === 'conflitos'
              ? 'bg-danger text-white'
              : isActive
                ? 'bg-white/20 text-white'
                : 'bg-warning-soft text-warning',
          )}
        >
          {badge}
          <span className="sr-only"> {badgeHint}</span>
        </span>
      )}
    </Link>
  )
}

function Topbar({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const { user } = useAuth()
  const { activeGrade, conflicts } = useSchedule()
  const { pathname } = useLocation()
  const { group, title } = currentPage(pathname)

  const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-canvas px-3 py-3 md:-mt-4 md:px-2 md:pt-4 md:pb-2 print:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menu"
        aria-expanded={menuOpen}
        className="grid size-11 place-items-center rounded-full bg-white shadow-(--shadow-float) lg:hidden"
      >
        <Icon name="menu" />
      </button>

      <p className="hidden min-w-0 flex-1 truncate text-[14px] sm:block" aria-label="Você está em">
        {group && (
          <>
            <span className="text-muted">{group}</span>
            <span className="mx-2 text-line" aria-hidden="true">
              /
            </span>
          </>
        )}
        {title && <span className="font-medium text-ink">{title}</span>}
      </p>
      <span className="flex-1 sm:hidden" />

      {activeGrade?.ano_semestre && (
        <span className="hidden h-11 items-center rounded-full bg-white px-4 text-[13px] font-medium shadow-(--shadow-float) md:flex">
          Semestre {activeGrade.ano_semestre}
        </span>
      )}

      <span className="hidden h-11 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium shadow-(--shadow-float) xl:flex">
        <Icon name="calendar" width={15} height={15} className="text-muted" />
        <span className="first-letter:uppercase">{today}</span>
      </span>

      <Link
        to={paths.conflitos}
        aria-label={conflicts.length ? `${conflicts.length} conflitos pendentes` : 'Sem conflitos pendentes'}
        className="relative grid size-11 place-items-center rounded-full bg-white shadow-(--shadow-float) transition-colors hover:bg-paper"
      >
        <Icon name="bell" />
        {conflicts.length > 0 && (
          <span className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-danger ring-2 ring-white" />
        )}
      </Link>

      {user && (
        <Link to={paths.conta} aria-label="Minha conta" className="rounded-full">
          <Avatar name={user.name} size="lg" />
        </Link>
      )}
    </header>
  )
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-ink font-display font-bold text-white',
        size === 'lg' ? 'size-11 text-[14px]' : 'size-9 text-[12.5px]',
      )}
    >
      {initials}
    </span>
  )
}
