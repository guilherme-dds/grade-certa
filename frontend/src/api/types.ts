// Espelha os schemas Pydantic de backend/schemas/*

import type { Role } from '@/auth/roles'

export interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  created_at: string
  /** Ainda não existe no backend (UserResponse) */
  role?: Role
}

export interface UserCreate {
  name: string
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
}
