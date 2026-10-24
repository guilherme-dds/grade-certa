import { api } from './client'

export interface ItemMatriz {
  disciplina: string
  aulas_semanais: number
  professor?: string
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
