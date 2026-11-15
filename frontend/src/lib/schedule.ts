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

// Cores das áreas (tokens em index.css): fundo suave e faixa à esquerda, para aulas vizinhas
// de áreas diferentes não se confundirem
const CORES_AREA = {
  linguagens: 'bg-area-linguagens shadow-[inset_3px_0_0_var(--color-area-linguagens-edge)]',
  idiomas: 'bg-area-idiomas shadow-[inset_3px_0_0_var(--color-area-idiomas-edge)]',
  arte: 'bg-area-arte shadow-[inset_3px_0_0_var(--color-area-arte-edge)]',
  matematica: 'bg-area-matematica shadow-[inset_3px_0_0_var(--color-area-matematica-edge)]',
  natureza: 'bg-area-natureza shadow-[inset_3px_0_0_var(--color-area-natureza-edge)]',
  humanas: 'bg-area-humanas shadow-[inset_3px_0_0_var(--color-area-humanas-edge)]',
  formacao: 'bg-area-formacao shadow-[inset_3px_0_0_var(--color-area-formacao-edge)]',
  corpo: 'bg-area-corpo shadow-[inset_3px_0_0_var(--color-area-corpo-edge)]',
  tecnologia: 'bg-area-tecnologia shadow-[inset_3px_0_0_var(--color-area-tecnologia-edge)]',
} as const
type AreaCor = keyof typeof CORES_AREA

// Início de palavra (sem acento) que indica a área. A ordem importa: "Educação Física" antes de
// "Física", "Ciências Jurídicas" antes de "Ciências" e "Itinerário Matemática…" cai em Matemática.
const PALAVRAS_POR_AREA: [AreaCor, string[]][] = [
  ['corpo', ['educacao fisica', 'ed fisica', 'ed. fisica', 'esporte']],
  ['humanas', ['juridic', 'historia', 'geografia', 'filosofia', 'sociologia', 'atualidades', 'humanas']],
  ['formacao', ['projeto de vida', 'crista', 'religi', 'etica', 'cidadania']],
  ['matematica', ['matematica', 'algebra', 'geometria', 'trigonometria', 'aritmetica', 'estatistica', 'financeira']],
  ['natureza', ['ciencia', 'biologia', 'fisica', 'quimica', 'laboratorio', 'natureza']],
  ['idiomas', ['ingles', 'espanhol', 'frances', 'lingua estrangeira']],
  ['arte', ['arte', 'musica', 'teatro', 'danca', 'talent']],
  ['linguagens', ['portugues', 'lingua', 'lp', 'gramatica', 'literatura', 'redacao', 'leitura', 'producao de texto']],
  ['tecnologia', ['tecnologia', 'informatica', 'robotica', 'programacao', 'computa']],
]

const semAcento = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Cor do cartão da aula pela área da disciplina; nome sem área conhecida ganha uma cor fixa pelo nome. */
export function getSubjectColor(subject: string): string {
  const nome = ` ${semAcento(subject || '').replace(/[^a-z0-9.]+/g, ' ')} `
  for (const [area, palavras] of PALAVRAS_POR_AREA) {
    if (palavras.some((p) => nome.includes(` ${p}`))) return CORES_AREA[area]
  }
  // Disciplinas próprias da escola (eletivas, projetos): sempre a mesma cor, nunca cinza
  const areas = Object.keys(CORES_AREA) as AreaCor[]
  let hash = 0
  for (const letra of nome) hash = (hash * 31 + letra.charCodeAt(0)) >>> 0
  return CORES_AREA[areas[hash % areas.length]]
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
