import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { roles, roleShortLabels } from '@/auth/roles'
import { navItemsFor } from '@/config/navigation'
import { cn } from '@/lib/cn'
import { institution } from '@/mocks/data'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-svh">
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 md:block">
        <Sidebar />
      </aside>

      {/* Mobile: barra superior + gaveta */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-navy px-4 md:hidden">
        <span className="font-bold text-white">GradeCerta</span>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          className="rounded-md p-2 text-white hover:bg-white/10"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative h-full w-64">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pt-20 pb-10 md:px-11 md:py-9">
        <Outlet />
      </main>
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, role, logout, setPreviewRole } = useAuth()
  if (!role) return null

  return (
    <nav aria-label="Principal" className="flex h-full flex-col bg-navy py-6">
      <div className="mx-5 mb-4 border-b border-white/10 pb-5">
        <p className="text-lg font-bold tracking-tight text-white">GradeCerta</p>
        <p className="mt-0.5 text-[11.5px] text-white/45">{institution.name}</p>
      </div>

      {import.meta.env.DEV && (
        <div className="px-5 pb-4">
          <p className="mb-2 text-[10.5px] tracking-wider text-white/40 uppercase">Visualizar como (dev)</p>
          <div className="flex gap-1 rounded-md bg-black/20 p-[3px]">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setPreviewRole(r)}
                aria-pressed={role === r}
                className={cn(
                  'flex-1 rounded py-1.5 text-xs',
                  role === r ? 'bg-primary font-semibold text-white' : 'text-white/55 hover:text-white',
                )}
              >
                {roleShortLabels[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="mt-2 flex flex-col">
        {navItemsFor(role).map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center border-l-[3px] px-5 py-2.5 text-[13px] transition-colors',
                  isActive
                    ? 'border-accent bg-white/8 font-semibold text-white'
                    : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="mx-5 mt-auto border-t border-white/10 pt-4">
        <p className="truncate text-[13px] font-medium text-white">{user?.name}</p>
        <p className="truncate text-[11.5px] text-white/45">{user?.email}</p>
        <button
          type="button"
          onClick={logout}
          className="mt-3 text-[12.5px] text-white/60 hover:text-white hover:underline"
        >
          Sair
        </button>
      </div>
    </nav>
  )
}
