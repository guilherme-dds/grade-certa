import { createBrowserRouter } from 'react-router'
import { RequireAuth, RequireGuest } from '@/auth/guards'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AvailabilityPage } from '@/pages/AvailabilityPage'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { ConflictsPage } from '@/pages/conflicts/ConflictsPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SchedulePage } from '@/pages/schedule/SchedulePage'
import { SubjectsPage } from '@/pages/SubjectsPage'
import { TeachersPage } from '@/pages/TeachersPage'

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
          { path: '/professores', element: <TeachersPage /> },
          { path: '/disciplinas', element: <SubjectsPage /> },
          { path: '/disponibilidade', element: <AvailabilityPage /> },
          { path: '/geracao', element: <ComingSoonPage title="Geração automática" /> },
          { path: '/grade', element: <SchedulePage /> },
          { path: '/conflitos', element: <ConflictsPage /> },
          { path: '/relatorios', element: <ComingSoonPage title="Relatórios" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
