import { Link } from 'react-router'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { teacherStats } from '@/mocks/data'

export function TeacherDashboard() {
  return (
    <div className="space-y-5">
      <Link
        to="/grade"
        className="block rounded-lg border border-primary-soft-line bg-primary-soft px-4 py-3.5 text-[13.5px] transition-colors hover:border-primary"
      >
        Nova grade publicada para o 2º semestre — confira seus horários →
      </Link>

      <StatGrid>
        <StatCard
          label="Minha disponibilidade"
          value={`Atualizada em ${teacherStats.availabilityUpdatedAt}`}
          size="sm"
        />
        <StatCard label="Aulas nesta semana" value={teacherStats.classesThisWeek} />
        <StatCard label="Status da grade" value={teacherStats.scheduleStatus} tone="success" size="md" />
      </StatGrid>
    </div>
  )
}
