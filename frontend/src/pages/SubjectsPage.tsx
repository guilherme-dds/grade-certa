import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader'
import { rooms, subjects } from '@/mocks/data'

export function SubjectsPage() {
  return (
    <>
      <PageHeader title="Disciplinas e salas" />

      <section className="mb-7">
        <SectionHeader
          title="Disciplinas"
          actions={
            <Button size="sm" disabled title="Em breve">
              + Nova disciplina
            </Button>
          }
        />
        <DataTable
          caption="Disciplinas"
          rows={subjects}
          rowKey={(row) => row.name}
          columns={[
            { header: 'Disciplina', cell: (row) => row.name },
            { header: 'Carga semanal', cell: (row) => `${row.weeklyHours}h`, className: 'font-mono' },
            { header: 'Professor responsável', cell: (row) => row.teacher },
            { header: 'Turmas', cell: (row) => row.classes, className: 'text-muted' },
          ]}
        />
      </section>

      <section>
        <SectionHeader
          title="Salas"
          actions={
            <Button size="sm" disabled title="Em breve">
              + Nova sala
            </Button>
          }
        />
        <DataTable
          caption="Salas"
          rows={rooms}
          rowKey={(row) => row.name}
          columns={[
            { header: 'Sala', cell: (row) => row.name },
            { header: 'Capacidade', cell: (row) => `${row.capacity} alunos` },
            { header: 'Tipo', cell: (row) => row.type, className: 'text-muted' },
          ]}
        />
      </section>
    </>
  )
}
