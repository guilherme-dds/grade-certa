import { useQuery } from '@tanstack/react-query'
import { getHistoricoGrades } from '@/api/grades'
import { getProfessores } from '@/api/professores'
import { getSalas } from '@/api/salas'
import { getTurmas } from '@/api/turmas'
import { DataTable } from '@/components/ui/DataTable'
import { SectionHeader } from '@/components/ui/PageHeader'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { formatDateTime } from '@/lib/schedule'

export function AdminDashboard() {
  const professores = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() }).data ?? []
  const turmas = useQuery({ queryKey: ['turmas'], queryFn: getTurmas }).data ?? []
  const salas = useQuery({ queryKey: ['salas'], queryFn: getSalas }).data ?? []
  const historico = useQuery({ queryKey: ['historicoGrades'], queryFn: getHistoricoGrades }).data ?? []

  const agora = new Date()
  const gradesNoMes = historico.filter((g) => {
    const criado = g.criado_em ? new Date(g.criado_em) : null
    return criado && criado.getMonth() === agora.getMonth() && criado.getFullYear() === agora.getFullYear()
  }).length

  return (
    <div className="space-y-7">
      <StatGrid>
        <StatCard
          label="Professores ativos"
          value={professores.filter((p) => p.ativo).length}
          suffix={`de ${professores.length}`}
        />
        <StatCard label="Turmas cadastradas" value={turmas.length} />
        <StatCard label="Salas cadastradas" value={salas.length} />
        <StatCard label="Grades geradas este mês" value={gradesNoMes} />
      </StatGrid>

      <section>
        <SectionHeader title="Últimas grades geradas" />
        {historico.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-xs text-muted">
            Nenhuma grade gerada ainda.
          </p>
        ) : (
          <DataTable
            caption="Últimas grades geradas"
            rows={historico.slice(0, 5)}
            rowKey={(row) => String(row.id)}
            columns={[
              { header: 'Grade', cell: (row) => row.nome },
              { header: 'Semestre', cell: (row) => row.ano_semestre ?? '—' },
              { header: 'Aulas', cell: (row) => row.total_aulas },
              { header: 'Gerada em', cell: (row) => formatDateTime(row.criado_em), className: 'text-muted' },
            ]}
          />
        )}
      </section>
    </div>
  )
}
