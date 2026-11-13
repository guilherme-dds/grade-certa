import type { IconName } from '@/components/ui/Icon'
import { paths } from './paths'

export type WorkflowStep = 'cadastros' | 'geracao' | 'revisao'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Itens do fluxo "montar a grade" mostram o número do passo e se já foi concluído */
  step?: { key: WorkflowStep; number: number }
  end?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

// Todos os usuários têm o mesmo acesso
export const navGroups: NavGroup[] = [
  {
    items: [{ to: paths.home, label: 'Início', icon: 'dashboard', end: true }],
  },
  {
    label: 'Montar a grade',
    items: [
      { to: paths.cadastros, label: 'Cadastros', icon: 'classes', step: { key: 'cadastros', number: 1 } },
      { to: paths.geracao, label: 'Gerar grade', icon: 'generate', step: { key: 'geracao', number: 2 } },
      { to: paths.grade, label: 'Revisar grade', icon: 'grid', step: { key: 'revisao', number: 3 } },
    ],
  },
  {
    label: 'Para professores',
    items: [{ to: paths.minhaGrade, label: 'Minha grade', icon: 'calendarUser' }],
  },
]

export const settingsItem: NavItem = { to: paths.configuracoes, label: 'Configurações', icon: 'settings' }

export const navItems: NavItem[] = [...navGroups.flatMap((g) => g.items), settingsItem]

/** Nome das abas, para o caminho exibido na barra do topo */
export const tabLabels: Record<string, string> = {
  [paths.professores]: 'Professores',
  [paths.turmas]: 'Turmas',
  [paths.salas]: 'Salas',
  [paths.conflitos]: 'Conflitos',
  [paths.relatorios]: 'Relatórios',
  [paths.conta]: 'Minha conta',
  [paths.usuarios]: 'Usuários',
}
