import { api } from './client'

export interface DisciplinaBackend {
  id?: number
  nome: string
  quantidade_aulas: number
  // Área do conhecimento (planejamento compartilhado). Nulo = inferida pelo nome
  area?: string | null
  // Tipo de sala exigido (ex: 'Laboratório'). Nulo = sala fixa da turma
  tipo_sala?: string | null
  // Exige uma aula dobrada por semana. Nulo = automático (Inglês individual, demais dobradas)
  aula_dobrada?: boolean | null
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
