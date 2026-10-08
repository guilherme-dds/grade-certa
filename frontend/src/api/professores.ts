import { api } from './client'

export type NivelEnsinoType = 'Anos Iniciais' | 'Anos Finais' | 'Ensino Médio'

export interface ProfessorBackend {
  id?: number
  nome: string
  email: string
  niveis_ensino?: NivelEnsinoType[]
  disciplinas: number[]
  carga_maxima_aulas: number
  ativo: boolean
}

export interface GetProfessoresParams {
  ativo?: boolean
  disciplina_id?: number
  nivel_ensino?: NivelEnsinoType
}

export async function getProfessores(params?: GetProfessoresParams): Promise<ProfessorBackend[]> {
  const { data } = await api.get<ProfessorBackend[]>('/professores/', { params })
  return data
}

export async function getProfessor(id: number): Promise<ProfessorBackend> {
  const { data } = await api.get<ProfessorBackend>(`/professores/${id}`)
  return data
}

export async function createProfessor(payload: Omit<ProfessorBackend, 'id'>): Promise<ProfessorBackend> {
  const { data } = await api.post<ProfessorBackend>('/professores/', payload)
  return data
}

export async function updateProfessor(id: number, payload: ProfessorBackend): Promise<ProfessorBackend> {
  const { data } = await api.put<ProfessorBackend>(`/professores/${id}`, payload)
  return data
}

export async function deleteProfessor(id: number): Promise<{ mensagem: string }> {
  const { data } = await api.delete<{ mensagem: string }>(`/professores/${id}`)
  return data
}
