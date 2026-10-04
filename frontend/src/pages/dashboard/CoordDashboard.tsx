import { Link } from 'react-router'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { coordStats } from '@/mocks/data'

export function CoordDashboard() {
  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard label="Status da grade" value={coordStats.scheduleStatus} tone="warning" size="md" />
        <StatCard label="Conflitos pendentes" value={coordStats.pendingConflicts} tone="danger" />
        <StatCard
          label="Disponibilidade pendente"
          value={coordStats.pendingAvailability}
          suffix={`de ${coordStats.totalTeachers} professores`}
        />
        <StatCard label="Próxima geração agendada" value={coordStats.nextGeneration} size="md" />
      </StatGrid>

      <div className="flex flex-wrap gap-2.5">
        <Link to="/geracao" className={buttonStyles()}>
          Gerar grade agora
        </Link>
        <Link to="/conflitos" className={buttonStyles({ variant: 'secondary' })}>
          Ver conflitos
        </Link>
        <Link to="/disciplinas" className={buttonStyles({ variant: 'secondary' })}>
          Cadastrar disciplina
        </Link>
      </div>
    </div>
  )
}
