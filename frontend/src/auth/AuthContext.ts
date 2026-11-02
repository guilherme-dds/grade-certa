import { createContext } from 'react'
import type { LoginRequest, User } from '@/api/types'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  /** true enquanto valida um token salvo (evita "piscar" a tela de login) */
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const meQueryKey = ['auth', 'me'] as const
