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
  /** Última vez que a disponibilidade foi salva (nulo = nunca informada) */
  disponibilidade_atualizada_em?: string | null
}

export type TipoDisponibilidade = 'indisponivel' | 'preferencial'

/** Horário marcado na grade de disponibilidade; horários não enviados ficam disponíveis */
export interface DisponibilidadeItem {
  dia_semana: string
  horario_inicio: string
  horario_fim: string
  tipo: TipoDisponibilidade
  nivel_ensino: string | null
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

export async function getDisponibilidadeProfessor(id: number): Promise<DisponibilidadeItem[]> {
  const { data } = await api.get<DisponibilidadeItem[]>(`/professores/${id}/disponibilidades`)
  return data
}

/** Substitui todos os horários marcados do professor */
export async function saveDisponibilidadeProfessor(
  id: number,
  itens: DisponibilidadeItem[],
): Promise<DisponibilidadeItem[]> {
  const { data } = await api.put<DisponibilidadeItem[]>(`/professores/${id}/disponibilidades`, itens)
  return data
}
