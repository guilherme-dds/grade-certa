import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth, RequireGuest } from '@/auth/guards'
import { paths } from '@/config/paths'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import {
  CadastrosSection,
  ConfiguracoesSection,
  GeracaoSection,
  GradeSection,
  GradeViews,
  Moved,
  MovedRelatorios,
} from '@/layouts/sections'
import { ConflictsPage } from '@/pages/conflicts/ConflictsPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { DisciplinasPage } from '@/pages/disciplinas/DisciplinasPage'
import { EscolaPage } from '@/pages/escola/EscolaPage'
import { GenerationHistoryPage } from '@/pages/generation/GenerationHistoryPage'
import { GenerationPage } from '@/pages/generation/GenerationPage'
import { GenerationRulesPage } from '@/pages/generation/GenerationRulesPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { SalasPage } from '@/pages/salas/SalasPage'
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
              { path: 'disciplinas', element: <DisciplinasPage /> },
              { path: 'salas', element: <SalasPage /> },
            ],
          },
          {
            path: paths.geracao,
            element: <GeracaoSection />,
            children: [
              { index: true, element: <GenerationPage /> },
              { path: 'regras', element: <GenerationRulesPage /> },
              { path: 'historico', element: <GenerationHistoryPage /> },
            ],
          },
          {
            path: paths.grade,
            element: <GradeSection />,
            children: [
              {
                element: <GradeViews />,
                children: [
                  { index: true, element: <SchedulePage /> },
                  { path: 'turmas/imprimir', element: <ReportsPage aba="turmas" /> },
                  { path: 'professores', element: <ReportsPage aba="professores" /> },
                  { path: 'salas', element: <ReportsPage aba="salas" /> },
                ],
              },
              { path: 'resumo', element: <ReportsPage aba="resumo" /> },
              { path: 'conflitos', element: <ConflictsPage /> },
              { path: 'relatorios', element: <MovedRelatorios /> },
            ],
          },
          {
            path: paths.configuracoes,
            element: <ConfiguracoesSection />,
            children: [
              { index: true, element: <Navigate to={paths.escola} replace /> },
              { path: 'escola', element: <EscolaPage /> },
              { path: 'conta', element: <AccountPage /> },
              { path: 'usuarios', element: <UsersPage /> },
            ],
          },

          // Endereços antigos (favoritos e links já compartilhados)
          { path: '/professores', element: <Moved to={paths.professores} /> },
          { path: '/disciplinas', element: <Moved to={paths.turmas} /> },
          { path: '/conflitos', element: <Moved to={paths.conflitos} /> },
          { path: '/relatorios', element: <MovedRelatorios /> },
          { path: '/usuarios', element: <Moved to={paths.usuarios} /> },
          { path: '/minha-conta', element: <Moved to={paths.conta} /> },
          // "Minha grade" era a visão do professor logado; hoje só o responsável usa o sistema
          { path: '/minha-grade', element: <Navigate to={paths.gradeProfessores} replace /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
