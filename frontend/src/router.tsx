import { createBrowserRouter } from 'react-router'
import { RequireAuth, RequireGuest } from '@/auth/guards'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AvailabilityPage } from '@/pages/AvailabilityPage'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SubjectsPage } from '@/pages/SubjectsPage'

export const router = createBrowserRouter([
  {
    element: <RequireGuest />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/cadastro', element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/disciplinas', element: <SubjectsPage /> },
          { path: '/disponibilidade', element: <AvailabilityPage /> },
          { path: '/geracao', element: <ComingSoonPage title="Geração automática" /> },
          { path: '/grade', element: <ComingSoonPage title="Grade gerada" /> },
          { path: '/conflitos', element: <ComingSoonPage title="Conflitos" /> },
          { path: '/relatorios', element: <ComingSoonPage title="Relatórios" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
