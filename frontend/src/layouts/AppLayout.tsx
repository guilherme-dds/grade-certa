import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'
import { navGroups, navItems, settingsItem, tabLabels, type NavItem } from '@/config/navigation'
import { paths } from '@/config/paths'
import { cn } from '@/lib/cn'
import { ScheduleProvider } from '@/schedule/ScheduleProvider'
import { useSchedule } from '@/schedule/useSchedule'
import { useWorkflow, type StepState } from '@/schedule/useWorkflow'

export function AppLayout() {
  return (
    <ScheduleProvider>
      <Shell />
    </ScheduleProvider>
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
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          />
          <div className="relative h-full w-[272px] p-3">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
        <main className="min-w-0 flex-1 px-4 pt-5 pb-12 md:px-2 md:pt-6 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Sidebar() {
  const { user, logout } = useAuth()
  const { conflicts } = useSchedule()
  const { steps } = useWorkflow()
  if (!user) return null

  return (
    <nav aria-label="Principal" className="card flex h-full flex-col overflow-y-auto px-3 py-6">
      <Link to={paths.home} className="mx-3 mb-7 rounded-lg">
        <Logo />
      </Link>

      <div className="flex flex-col gap-6">
        {navGroups.map((group, gi) => (
          <div key={group.label ?? gi}>
            {group.label && <p className="mb-1.5 px-3 text-[12px] font-medium text-muted/80">{group.label}</p>}
            <ul className={cn('flex flex-col gap-0.5', group.items.some((i) => i.step) && 'relative')}>
              {group.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink
                    item={item}
                    state={item.step ? steps[item.step.key] : undefined}
                    badge={item.step?.key === 'revisao' ? conflicts.length : 0}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-6">
        <SidebarLink item={settingsItem} />
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

const STEP_HINT: Record<StepState, string> = { done: 'concluído', current: 'próximo passo', todo: 'pendente' }

function SidebarLink({ item, state, badge = 0 }: { item: NavItem; state?: StepState; badge?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-full px-3 py-2.5 text-[14px] transition-colors',
          isActive
            ? 'bg-ink font-semibold text-white shadow-[0_6px_16px_-8px_rgb(21_22_26/0.6)]'
            : 'text-muted hover:bg-paper hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {item.step && state ? (
            <span
              className={cn(
                'grid size-[22px] shrink-0 place-items-center rounded-full text-[11.5px] font-bold tabular-nums',
                state === 'done' && 'bg-accent text-ink',
                state === 'current' && (isActive ? 'bg-white text-ink' : 'bg-ink text-white'),
                state === 'todo' && (isActive ? 'ring-1 ring-white/40' : 'ring-1 ring-line'),
              )}
            >
              {state === 'done' ? <Icon name="check" width={13} height={13} strokeWidth={2.6} /> : item.step.number}
            </span>
          ) : (
            <Icon name={item.icon} className="shrink-0" />
          )}
          <span className="flex-1 truncate">
            {item.label}
            {item.step && state && <span className="sr-only">, {STEP_HINT[state]}</span>}
          </span>
          {badge > 0 && (
            <span className="rounded-full bg-danger px-1.5 py-px text-[11px] font-semibold text-white tabular-nums">
              {badge}
              <span className="sr-only"> conflitos</span>
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function Topbar({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const { user } = useAuth()
  const { activeGrade, conflicts } = useSchedule()
  const { pathname } = useLocation()
  const section = navItems.find((i) => (i.to === paths.home ? pathname === paths.home : pathname.startsWith(i.to)))
  const tab = tabLabels[pathname]

  const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-canvas/85 px-3 py-3 backdrop-blur md:top-4 md:rounded-full md:px-2 md:py-0 print:hidden">
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
        {section && (
          <Link to={section.to} className={cn('font-medium', tab ? 'text-muted hover:text-ink' : 'text-ink')}>
            {section.label}
          </Link>
        )}
        {tab && (
          <>
            <span className="mx-2 text-line" aria-hidden="true">/</span>
            <span className="font-medium text-ink">{tab}</span>
          </>
        )}
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
