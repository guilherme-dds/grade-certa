import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth, RequireGuest } from '@/auth/guards'
import { paths } from '@/config/paths'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { CadastrosSection, ConfiguracoesSection, GradeSection, Moved } from '@/layouts/sections'
import { ConflictsPage } from '@/pages/conflicts/ConflictsPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { GenerationPage } from '@/pages/generation/GenerationPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { SalasPage } from '@/pages/salas/SalasPage'
import { MyGradePage } from '@/pages/schedule/MyGradePage'
import { SchedulePage } from '@/pages/schedule/SchedulePage'
import { TeachersPage } from '@/pages/TeachersPage'
import { TurmasPage } from '@/pages/turmas/TurmasPage'
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
          { path: paths.home, element: <DashboardPage /> },
          {
            path: paths.cadastros,
            element: <CadastrosSection />,
            children: [
              { index: true, element: <Navigate to={paths.professores} replace /> },
              { path: 'professores', element: <TeachersPage /> },
              { path: 'turmas', element: <TurmasPage /> },
              { path: 'salas', element: <SalasPage /> },
            ],
          },
          { path: paths.geracao, element: <GenerationPage /> },
          {
            path: paths.grade,
            element: <GradeSection />,
            children: [
              { index: true, element: <SchedulePage /> },
              { path: 'conflitos', element: <ConflictsPage /> },
              { path: 'relatorios', element: <ReportsPage /> },
            ],
          },
          { path: paths.minhaGrade, element: <MyGradePage /> },
          {
            path: paths.configuracoes,
            element: <ConfiguracoesSection />,
            children: [
              { index: true, element: <Navigate to={paths.conta} replace /> },
              { path: 'conta', element: <AccountPage /> },
              { path: 'usuarios', element: <UsersPage /> },
            ],
          },

          // Endereços antigos (favoritos e links já compartilhados)
          { path: '/professores', element: <Moved to={paths.professores} /> },
          { path: '/disciplinas', element: <Moved to={paths.turmas} /> },
          { path: '/conflitos', element: <Moved to={paths.conflitos} /> },
          { path: '/relatorios', element: <Moved to={paths.relatorios} /> },
          { path: '/usuarios', element: <Moved to={paths.usuarios} /> },
          { path: '/minha-conta', element: <Moved to={paths.conta} /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
