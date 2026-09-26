import { api } from './client'
import type { LoginRequest, TokenResponse, User } from './types'

export async function login(credentials: LoginRequest) {
  const { data } = await api.post<TokenResponse>('/auth/login', credentials)
  return data
}

export async function getMe() {
  const { data } = await api.get<User>('/auth/me')
  return data
}
