// Utilitários de exibição da grade (sem dados: tudo que é cadastro vem do core-service)

export const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const
export type WeekDay = (typeof weekDays)[number]

export const niveisEnsino = ['Anos Iniciais', 'Anos Finais', 'Ensino Médio'] as const
export type NivelEnsino = (typeof niveisEnsino)[number]

/** Cor do cartão da aula pela área da disciplina */
export function getSubjectColor(subject: string): string {
  const clean = (subject || '').trim().toLowerCase()
  if (clean.includes('mat') || clean.includes('geom')) return 'bg-primary-soft'
  if (clean.includes('port') || clean.includes('ingl') || clean.includes('arte') || clean.includes('red'))
    return 'bg-warning-soft'
  if (clean.includes('cien') || clean.includes('ciên') || clean.includes('quí') || clean.includes('qui') || clean.includes('bio'))
    return 'bg-lilac-soft'
  if (clean.includes('hist') || clean.includes('geog') || clean.includes('soc') || clean.includes('filo'))
    return 'bg-danger-soft'
  return 'bg-line-soft'
}

/** "Ana Ferreira" → "Ana F." */
export function shortTeacherName(name?: string | null) {
  if (!name) return 'Sem professor'
  const [first, ...rest] = name.trim().split(' ')
  const last = rest.at(-1)
  return last ? `${first} ${last[0]}.` : first
}

/** "07:20 - 08:10" → ["07:20", "08:10"] */
export function splitHorario(horario: string): [string, string] {
  const [inicio, fim] = horario.split('-').map((p) => p.trim())
  return [inicio, fim]
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
