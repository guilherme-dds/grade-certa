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

/** Renomeia a disciplina; o novo nome também vai para as matrizes das turmas */
export async function renameDisciplina(id: number, nome: string): Promise<DisciplinaBackend> {
  const { data } = await api.put<DisciplinaBackend>(`/disciplinas/${id}`, { nome })
  return data
}

/**
 * Exclui a disciplina e a tira do cadastro dos professores. Se ela estiver em alguma matriz,
 * o backend só aceita com `tirarDasMatrizes` (as aulas dela saem dessas matrizes).
 */
export async function deleteDisciplina(id: number, opcoes: { tirarDasMatrizes?: boolean } = {}): Promise<void> {
  await api.delete(`/disciplinas/${id}`, { params: { tirar_das_matrizes: opcoes.tirarDasMatrizes || undefined } })
}
