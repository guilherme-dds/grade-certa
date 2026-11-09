import { createBrowserRouter } from 'react-router'
import { RequireAuth, RequireGuest } from '@/auth/guards'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ConflictsPage } from '@/pages/conflicts/ConflictsPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { GenerationPage } from '@/pages/generation/GenerationPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { MyGradePage } from '@/pages/schedule/MyGradePage'
import { SchedulePage } from '@/pages/schedule/SchedulePage'
import { SubjectsPage } from '@/pages/SubjectsPage'
import { TeachersPage } from '@/pages/TeachersPage'
import { AccountPage } from '@/pages/users/AccountPage'
import { UsersPage } from '@/pages/users/UsersPage'

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
          { path: '/geracao', element: <GenerationPage /> },
          { path: '/grade', element: <SchedulePage /> },
          { path: '/minha-grade', element: <MyGradePage /> },
          { path: '/conflitos', element: <ConflictsPage /> },
          { path: '/relatorios', element: <ReportsPage /> },
          { path: '/usuarios', element: <UsersPage /> },
          { path: '/minha-conta', element: <AccountPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
