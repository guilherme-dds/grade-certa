import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe, login as loginRequest } from '@/api/auth'
import { UNAUTHORIZED_EVENT } from '@/api/client'
import type { LoginRequest } from '@/api/types'
import { AuthContext, meQueryKey, type AuthContextValue } from './AuthContext'
import { getUserRole, type Role } from './roles'
import { tokenStorage } from './tokenStorage'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => tokenStorage.get())
  const [previewRole, setPreviewRole] = useState<Role | null>(null)

  const meQuery = useQuery({
    queryKey: meQueryKey,
    queryFn: getMe,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const logout = useCallback(() => {
    tokenStorage.clear()
    setToken(null)
    setPreviewRole(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout)
  }, [logout])

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const { access_token } = await loginRequest(credentials)
      tokenStorage.set(access_token)
      setToken(access_token)
      await queryClient.fetchQuery({ queryKey: meQueryKey, queryFn: getMe })
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(() => {
    const user = token ? (meQuery.data ?? null) : null
    const role = user ? ((import.meta.env.DEV && previewRole) || getUserRole(user)) : null
    return {
      user,
      role,
      isAuthenticated: user !== null,
      isLoading: Boolean(token) && meQuery.isPending,
      login,
      logout,
      setPreviewRole,
    }
  }, [token, meQuery.data, meQuery.isPending, previewRole, login, logout])

  return <AuthContext value={value}>{children}</AuthContext>
}
