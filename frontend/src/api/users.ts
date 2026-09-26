import { api } from './client'
import type { User, UserCreate } from './types'

export async function createUser(payload: UserCreate) {
  // Barra final obrigatória: o FastAPI responde 307 para /users
  const { data } = await api.post<User>('/users/', payload)
  return data
}
