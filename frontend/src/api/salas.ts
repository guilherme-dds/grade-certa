import { api } from './client'

export const TIPOS_SALA = ['Sala comum', 'Laboratório', 'Educação física'] as const

export interface SalaBackend {
  id?: number
  nome: string
  capacidade: number
  tipo: string
}

export async function getSalas(): Promise<SalaBackend[]> {
  const { data } = await api.get<SalaBackend[]>('/salas/')
  return data
}

export async function createSala(payload: Omit<SalaBackend, 'id'>): Promise<SalaBackend> {
  const { data } = await api.post<SalaBackend>('/salas/', payload)
  return data
}

export async function updateSala(id: number, payload: SalaBackend): Promise<SalaBackend> {
  const { data } = await api.put<SalaBackend>(`/salas/${id}`, payload)
  return data
}

export async function deleteSala(id: number): Promise<void> {
  await api.delete(`/salas/${id}`)
}
