import { DataTable } from '@/components/ui/DataTable'
import { SectionHeader } from '@/components/ui/PageHeader'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { adminStats, recentInstitutions, type InstitutionStatus } from '@/mocks/data'

const statusStyles: Record<InstitutionStatus, { label: string; className: string }> = {
  ativa: { label: 'Ativa', className: 'text-primary' },
  onboarding: { label: 'Onboarding', className: 'text-warning' },
}

export function AdminDashboard() {
  return (
    <div className="space-y-7">
      <StatGrid>
        <StatCard label="Instituições ativas" value={adminStats.activeInstitutions} />
        <StatCard label="Usuários cadastrados" value={adminStats.users} />
        <StatCard label="Grades geradas este mês" value={adminStats.schedulesThisMonth} />
        <StatCard label="Chamados abertos" value={adminStats.openTickets} tone="danger" />
      </StatGrid>

      <section>
        <SectionHeader title="Instituições recentes" />
        <DataTable
          caption="Instituições recentes"
          rows={recentInstitutions}
          rowKey={(row) => row.name}
          columns={[
            { header: 'Instituição', cell: (row) => row.name },
            { header: 'Plano', cell: (row) => row.plan },
            {
              header: 'Status',
              cell: (row) => (
                <span className={statusStyles[row.status].className}>{statusStyles[row.status].label}</span>
              ),
            },
          ]}
        />
      </section>
    </div>
  )
}
