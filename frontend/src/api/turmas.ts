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
  matriz_curricular?: ItemMatriz[]
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
