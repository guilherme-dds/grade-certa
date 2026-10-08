import { api } from './client'

export interface DisciplinaBackend {
  id?: number
  nome: string
  quantidade_aulas: number
}

export async function getDisciplinas(): Promise<DisciplinaBackend[]> {
  const { data } = await api.get<DisciplinaBackend[]>('/disciplinas/')
  return data
}

export async function createDisciplina(payload: { nome: string; quantidade_aulas?: number }): Promise<DisciplinaBackend> {
  const { data } = await api.post<DisciplinaBackend>('/disciplinas/', {
    nome: payload.nome,
    quantidade_aulas: payload.quantidade_aulas ?? 4,
  })
  return data
}
