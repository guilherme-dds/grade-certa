import { useAuth } from '@/auth/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { roleLabels } from '@/auth/roles'
import { useSchedule } from '@/schedule/useSchedule'
import { AdminDashboard } from './AdminDashboard'
import { CoordDashboard } from './CoordDashboard'
import { TeacherDashboard } from './TeacherDashboard'

export function DashboardPage() {
  const { user, role } = useAuth()
  const { activeGrade } = useSchedule()
  const firstName = user?.name.split(' ')[0]
  const semestre = activeGrade?.ano_semestre ? ` · Semestre ${activeGrade.ano_semestre}` : ''

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} description={role ? `${roleLabels[role]}${semestre}` : undefined} />
      {role === 'admin' && <AdminDashboard />}
      {role === 'coordenacao' && <CoordDashboard />}
      {role === 'professor' && <TeacherDashboard />}
    </>
  )
}
