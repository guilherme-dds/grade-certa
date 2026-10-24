import { api } from './client'

export interface ItemMatriz {
  disciplina: string
  aulas_semanais: number
  /** Professores que dão a aula juntos (ou em rodízio); o gerador reserva todos no horário */
  professores?: string[]
  /** Formato antigo, com um professor só (o backend mantém igual ao primeiro de `professores`) */
  professor?: string | null
  /** Dias e horários definidos pela escola; as demais aulas o gerador distribui */
  horarios_fixos?: HorarioFixo[]
  /** Aula extra (ex.: laboratório): ocupa horário na grade, mas não entra no total da matriz */
  extra?: boolean
}

export interface HorarioFixo {
  dia_semana: string
  horario: string
}

/** Professores do item, aceitando matrizes salvas no formato antigo */
export function professoresDoItem(item: ItemMatriz): string[] {
  if (item.professores?.length) return item.professores
  return item.professor ? [item.professor] : []
}

export interface TurmaBackend {
  id?: number
  nome: string
  turno: string
  /** Define os horários de aula da turma (cada nível tem sua grade de horários) */
  nivel_ensino?: string | null
  matriz_curricular?: ItemMatriz[]
  sala_id?: number | null
}

export async function getTurmas(): Promise<TurmaBackend[]> {
  const { data } = await api.get<TurmaBackend[]>('/turmas/')
  return data
}

export async function createTurma(payload: Omit<TurmaBackend, 'id'>): Promise<TurmaBackend> {
  const { data } = await api.post<TurmaBackend>('/turmas/', payload)
  return data
}

export async function updateTurma(id: number, payload: TurmaBackend): Promise<TurmaBackend> {
  const { data } = await api.put<TurmaBackend>(`/turmas/${id}`, payload)
  return data
}

export async function deleteTurma(id: number): Promise<void> {
  await api.delete(`/turmas/${id}`)
}
