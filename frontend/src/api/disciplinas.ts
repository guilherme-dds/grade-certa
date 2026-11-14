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

// Área, aula dobrada e sala exigida ficam por conta do gerador (inferidas pelo nome da disciplina)
export async function createDisciplina(payload: {
  nome: string
  quantidade_aulas?: number
}): Promise<DisciplinaBackend> {
  const { data } = await api.post<DisciplinaBackend>('/disciplinas/', {
    nome: payload.nome,
    quantidade_aulas: payload.quantidade_aulas ?? 4,
  })
  return data
}

/** Exclui a disciplina e a tira do cadastro dos professores (o backend recusa se ela estiver em alguma matriz) */
export async function deleteDisciplina(id: number): Promise<void> {
  await api.delete(`/disciplinas/${id}`)
}
