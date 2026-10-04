import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'

function FullPageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted">
      Carregando…
    </div>
  )
}

/** Rotas que exigem login. Guarda a rota original para voltar após o login. */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Rotas só para visitantes (login, cadastro). */
export function RequireGuest() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <FullPageLoader />
  if (isAuthenticated) return <Navigate to="/" replace />
  return <Outlet />
}
