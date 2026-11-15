// Utilitários de exibição da grade (sem dados: tudo que é cadastro vem do core-service)
import type { HorariosEscola } from '@/api/grades'

export const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const
export type WeekDay = (typeof weekDays)[number]

export const niveisEnsino = ['Anos Iniciais', 'Anos Finais', 'Ensino Médio'] as const
export type NivelEnsino = (typeof niveisEnsino)[number]

/**
 * Horários de aula de uma turma pelo nível e turno, como em core-service/services/time_slots.py
 * (o backend é quem valida; isto só monta as opções da tela).
 */
export function horariosDaTurma(
  turma: { turno: string; nivel_ensino?: string | null },
  horarios: HorariosEscola,
): string[] {
  const grade = horarios.niveis[turma.nivel_ensino ?? 'Anos Finais'] ?? horarios.niveis['Anos Finais']
  if (!grade) return []
  const turno = turma.turno.toLowerCase()
  if (temTardesParciais(turma.turno) || turno.includes('integral')) return [...grade.manha, ...grade.tarde]
  if (turno.includes('tarde') || turno.includes('vespertino')) return grade.tarde
  return grade.manha
}

/** Todas as manhãs e só algumas tardes (ex.: Ensino Médio com "1 tarde fechada") */
export const TURNO_MANHA_E_TARDES = 'Manhã + tardes'

export function temTardesParciais(turno: string) {
  const t = turno.toLowerCase()
  return t.includes('+') || (t.includes('manh') && t.includes('tarde'))
}

/**
 * Quantos horários de aula a turma tem na semana. null quando não dá para saber
 * (ex.: "Manhã + tardes" sem as tardes escolhidas).
 */
export function capacidadeSemanal(
  turma: { turno: string; nivel_ensino?: string | null; tardes?: string[] | null },
  horarios: HorariosEscola,
): number | null {
  const grade = horarios.niveis[turma.nivel_ensino ?? 'Anos Finais'] ?? horarios.niveis['Anos Finais']
  if (!grade) return null
  if (temTardesParciais(turma.turno)) {
    return turma.tardes?.length ? grade.manha.length * weekDays.length + grade.tarde.length * turma.tardes.length : null
  }
  return horariosDaTurma(turma, horarios).length * weekDays.length
}

/** Cor do cartão da aula pela área da disciplina */
export function getSubjectColor(subject: string): string {
  const clean = (subject || '').trim().toLowerCase()
  if (clean.includes('mat') || clean.includes('geom')) return 'bg-primary-soft'
  if (clean.includes('port') || clean.includes('ingl') || clean.includes('arte') || clean.includes('red'))
    return 'bg-warning-soft'
  if (
    clean.includes('cien') ||
    clean.includes('ciên') ||
    clean.includes('quí') ||
    clean.includes('qui') ||
    clean.includes('bio')
  )
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
  // Códigos como "Educação Física 1" ficam inteiros: abreviar viraria "Educação 1."
  if (last && /^\d+$/.test(last)) return name.trim()
  return last ? `${first} ${last[0]}.` : first
}

/** Tempo de busca do gerador: 45 → "45 s", 120.05 → "2 min", 600.3 → "10 min". */
export function formatDuracao(segundos: number) {
  const s = Math.max(1, Math.round(segundos))
  if (s < 60) return `${s} s`
  const resto = s % 60
  return resto ? `${Math.floor(s / 60)} min ${resto} s` : `${s / 60} min`
}

/** "07:20 - 08:10" → ["07:20", "08:10"] */
export function splitHorario(horario: string): [string, string] {
  const [inicio, fim] = horario.split('-').map((p) => p.trim())
  return [inicio, fim]
}

/**
 * O servidor grava as datas em UTC sem indicar o fuso ("2026-11-15T15:13:57"). Sem o "Z",
 * o navegador leria como hora local e mostraria 3 h a mais no Brasil.
 */
export function parseServerDate(iso: string) {
  const semFuso = iso.includes('T') && !/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(iso)
  return new Date(semFuso ? `${iso}Z` : iso)
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  const d = parseServerDate(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
