import { useAuth } from '@/auth/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { institution } from '@/mocks/data'
import { AdminDashboard } from './AdminDashboard'
import { CoordDashboard } from './CoordDashboard'
import { TeacherDashboard } from './TeacherDashboard'

export function DashboardPage() {
  const { user, role } = useAuth()
  const firstName = user?.name.split(' ')[0]

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} description={`${institution.name} · ${institution.term}`} />
      {role === 'admin' && <AdminDashboard />}
      {role === 'coordenacao' && <CoordDashboard />}
      {role === 'professor' && <TeacherDashboard />}
    </>
  )
}
