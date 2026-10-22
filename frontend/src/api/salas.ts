import { api } from './client'

export const TIPOS_SALA = ['Sala comum', 'Laboratório', 'Educação física'] as const

export interface IndisponibilidadeSala {
  id?: number
  dia_semana: string
  horario_inicio: string
  horario_fim: string
  motivo?: string | null
}

export interface SalaBackend {
  id?: number
  nome: string
  capacidade: number
  tipo: string
  // Horários em que a sala está ocupada por outras atividades; o gerador não aloca aulas neles
  indisponibilidades?: IndisponibilidadeSala[]
}

export async function getSalas(): Promise<SalaBackend[]> {
  const { data } = await api.get<SalaBackend[]>('/salas/')
  return data
}

export async function createSala(payload: Omit<SalaBackend, 'id'>): Promise<SalaBackend> {
  const { data } = await api.post<SalaBackend>('/salas/', payload)
  return data
}

// Sem `indisponibilidades` no payload, o backend mantém as já cadastradas
export async function updateSala(id: number, payload: SalaBackend): Promise<SalaBackend> {
  const { data } = await api.put<SalaBackend>(`/salas/${id}`, payload)
  return data
}

export async function deleteSala(id: number): Promise<void> {
  await api.delete(`/salas/${id}`)
}

export async function addIndisponibilidadeSala(
  salaId: number,
  payload: Omit<IndisponibilidadeSala, 'id'>,
): Promise<IndisponibilidadeSala> {
  const { data } = await api.post<IndisponibilidadeSala>(`/salas/${salaId}/indisponibilidades`, payload)
  return data
}

export async function removeIndisponibilidadeSala(salaId: number, indisponibilidadeId: number): Promise<void> {
  await api.delete(`/salas/${salaId}/indisponibilidades/${indisponibilidadeId}`)
}
