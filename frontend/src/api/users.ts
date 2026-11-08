import { api } from './client'
import type { User, UserCreate } from './types'

export async function createUser(payload: UserCreate) {
  // Barra final obrigatória: o FastAPI responde 307 para /users
  const { data } = await api.post<User>('/users/', payload)
  return data
}

export async function getUsers() {
  const { data } = await api.get<User[]>('/users/')
  return data
}

/** Ativa ou desativa a conta (desativada, não entra nem usa o sistema) */
export async function setUserActive(id: number, isActive: boolean) {
  const { data } = await api.patch<User>(`/users/${id}`, { is_active: isActive })
  return data
}

export async function deleteUser(id: number) {
  await api.delete(`/users/${id}`)
}
