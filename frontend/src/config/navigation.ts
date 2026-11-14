import type { IconName } from '@/components/ui/Icon'
import { paths } from './paths'

export type WorkflowStep = 'cadastros' | 'geracao' | 'revisao'

/** Contadores que aparecem à direita de um item (pendências daquela tela) */
export type NavBadge = 'semDisponibilidade' | 'semMatriz' | 'conflitos'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
  badge?: NavBadge
  /** Outros endereços que pertencem a este item (ex.: a impressão das turmas fica em "Por turma") */
  also?: string[]
}

export interface NavGroup {
  label?: string
  /** Passo do fluxo "montar a grade", exibido acima do título das telas do grupo */
  step?: { key: WorkflowStep; number: number }
  items: NavItem[]
}

// Uma entrada por tela, agrupadas pelos passos de montar a grade
export const navGroups: NavGroup[] = [
  {
    items: [{ to: paths.home, label: 'Início', icon: 'dashboard', end: true }],
  },
  {
    label: 'Cadastros',
    step: { key: 'cadastros', number: 1 },
    items: [
      { to: paths.professores, label: 'Professores', icon: 'teachers', badge: 'semDisponibilidade' },
      { to: paths.turmas, label: 'Turmas', icon: 'classes', badge: 'semMatriz' },
      { to: paths.disciplinas, label: 'Disciplinas', icon: 'book' },
      { to: paths.salas, label: 'Salas', icon: 'door' },
    ],
  },
  {
    label: 'Gerar grade',
    step: { key: 'geracao', number: 2 },
    items: [
      { to: paths.geracao, label: 'Nova grade', icon: 'sparkles', end: true },
      { to: paths.geracaoRegras, label: 'Regras', icon: 'listCheck' },
      { to: paths.geracaoHistorico, label: 'Histórico', icon: 'history' },
    ],
  },
  {
    label: 'Revisar grade',
    step: { key: 'revisao', number: 3 },
    items: [
      {
        to: paths.grade,
        label: 'Grade',
        icon: 'grid',
        end: true,
        // Por turma, por professor e por sala são subabas dentro deste item
        also: [paths.gradeProfessores, paths.gradeSalas, paths.gradeImpressao],
      },
      { to: paths.resumo, label: 'Resumo', icon: 'chart' },
      { to: paths.conflitos, label: 'Conflitos', icon: 'conflict', badge: 'conflitos' },
    ],
  },
]

export const settingsGroup: NavGroup = {
  label: 'Configurações',
  items: [
    { to: paths.escola, label: 'Escola e jornada', icon: 'settings' },
    { to: paths.usuarios, label: 'Usuários', icon: 'users' },
  ],
}

const allGroups = [...navGroups, settingsGroup]

/** Telas que não têm item próprio no menu, mas precisam de título */
const extraTitles: Record<string, string> = {
  [paths.conta]: 'Minha conta',
  [paths.gradeImpressao]: 'Imprimir turmas',
}

/** O item do menu que corresponde ao endereço atual */
export function isNavItemActive(item: NavItem, pathname: string) {
  if (pathname === item.to || item.also?.includes(pathname)) return true
  return !item.end && pathname.startsWith(`${item.to}/`)
}

/** Grupo e título da tela atual, para o caminho na barra do topo e o título da página */
export function currentPage(pathname: string): { group?: string; title?: string } {
  for (const group of allGroups) {
    const item = group.items.find((i) => isNavItemActive(i, pathname))
    if (item) return { group: group.label, title: extraTitles[pathname] ?? item.label }
  }
  if (extraTitles[pathname]) {
    return {
      group: pathname.startsWith(paths.configuracoes) ? settingsGroup.label : undefined,
      title: extraTitles[pathname],
    }
  }
  return {}
}
