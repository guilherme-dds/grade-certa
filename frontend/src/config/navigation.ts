import type { Role } from '@/auth/roles'

export interface NavItem {
  to: string
  label: string
  roles: Role[]
}

// Menu por perfil, conforme Fluxos.dc.html. Telas sem design fechado caem no placeholder.
export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', roles: ['admin', 'coordenacao', 'professor'] },
  { to: '/disciplinas', label: 'Disciplinas e salas', roles: ['coordenacao'] },
  { to: '/disponibilidade', label: 'Disponibilidade', roles: ['professor'] },
  { to: '/geracao', label: 'Geração automática', roles: ['coordenacao'] },
  { to: '/grade', label: 'Grade gerada', roles: ['coordenacao', 'professor'] },
  { to: '/conflitos', label: 'Conflitos', roles: ['coordenacao'] },
  { to: '/relatorios', label: 'Relatórios', roles: ['admin', 'coordenacao'] },
]

export function navItemsFor(role: Role) {
  return navItems.filter((item) => item.roles.includes(role))
}
