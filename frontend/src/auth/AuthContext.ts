import { createContext } from 'react'
import type { LoginRequest, User } from '@/api/types'
import type { Role } from './roles'

export interface AuthContextValue {
  user: User | null
  role: Role | null
  isAuthenticated: boolean
  /** true enquanto valida um token salvo (evita "piscar" a tela de login) */
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
  /** Só em dev: simula outro perfil (equivalente ao "Visualizar como" do protótipo) */
  setPreviewRole: (role: Role | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const meQueryKey = ['auth', 'me'] as const
