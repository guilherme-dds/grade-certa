import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getHistoricoGrades } from '@/api/grades'
import { getProfessores } from '@/api/professores'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { formatDateTime } from '@/lib/schedule'
import { useSchedule } from '@/schedule/useSchedule'

export function CoordDashboard() {
  const pendingConflicts = useSchedule().conflicts.length
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })
  const historicoQuery = useQuery({ queryKey: ['historicoGrades'], queryFn: getHistoricoGrades })

  const ativos = (professoresQuery.data ?? []).filter((p) => p.ativo)
  const semDisponibilidade = ativos.filter((p) => !p.disponibilidade_atualizada_em).length
  const ultimaGrade = historicoQuery.data?.[0]

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard
          label="Grade atual"
          value={ultimaGrade ? ultimaGrade.nome : 'Nenhuma gerada'}
          tone={ultimaGrade ? 'success' : 'warning'}
          size="md"
        />
        <StatCard
          label="Conflitos pendentes"
          value={pendingConflicts}
          tone={pendingConflicts > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Disponibilidade não informada"
          value={semDisponibilidade}
          suffix={`de ${ativos.length} professores ativos`}
          tone={semDisponibilidade > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Última geração"
          value={ultimaGrade ? formatDateTime(ultimaGrade.criado_em) : '—'}
          size="md"
        />
      </StatGrid>

      <div className="flex flex-wrap gap-2.5">
        <Link to="/geracao" className={buttonStyles()}>
          Gerar grade agora
        </Link>
        <Link to="/conflitos" className={buttonStyles({ variant: 'secondary' })}>
          Ver conflitos
        </Link>
        <Link to="/disciplinas" className={buttonStyles({ variant: 'secondary' })}>
          Turmas e salas
        </Link>
      </div>
    </div>
  )
}
