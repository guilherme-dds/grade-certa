export interface NavItem {
  to: string
  label: string
}

// Todos os usuários têm o mesmo acesso
export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/professores', label: 'Professores' },
  { to: '/disciplinas', label: 'Turmas e salas' },
  { to: '/geracao', label: 'Geração automática' },
  { to: '/grade', label: 'Grade gerada' },
  { to: '/conflitos', label: 'Conflitos' },
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/usuarios', label: 'Usuários' },
]
