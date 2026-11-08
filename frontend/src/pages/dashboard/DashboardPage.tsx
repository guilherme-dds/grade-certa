import { useAuth } from '@/auth/useAuth'
import { PageHeader } from '@/components/ui/PageHeader'
import { useSchedule } from '@/schedule/useSchedule'
import { DashboardOverview } from './DashboardOverview'

export function DashboardPage() {
  const { user } = useAuth()
  const { activeGrade } = useSchedule()
  const firstName = user?.name.split(' ')[0]

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description={activeGrade?.ano_semestre ? `Semestre ${activeGrade.ano_semestre}` : undefined}
      />
      <DashboardOverview />
    </>
  )
}
