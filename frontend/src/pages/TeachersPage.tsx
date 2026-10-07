import { useMemo, useState } from 'react'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { availableSubjectsList, initialTeachers, type Teacher } from '@/mocks/teachers'
import { TeacherDialog } from './teachers/TeacherDialog'

export function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [subjectFilter, setSubjectFilter] = useState<string>('todas')

  // Modais
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null)

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const total = teachers.length
    const active = teachers.filter((t) => t.status === 'ativo').length
    const totalHours = teachers.reduce((acc, t) => acc + t.currentWeeklyHours, 0)
    const avgHours = active > 0 ? (totalHours / active).toFixed(1) : '0'

    return { total, active, totalHours, avgHours }
  }, [teachers])

  // Filtragem da tabela
  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      const matchesSearch =
        teacher.name.toLowerCase().includes(search.toLowerCase()) ||
        teacher.email.toLowerCase().includes(search.toLowerCase()) ||
        teacher.subjects.some((s) => s.toLowerCase().includes(search.toLowerCase()))

      const matchesStatus =
        statusFilter === 'todos'
          ? true
          : statusFilter === 'ativos'
            ? teacher.status === 'ativo'
            : teacher.status === 'inativo'

      const matchesSubject =
        subjectFilter === 'todas' ? true : teacher.subjects.includes(subjectFilter)

      return matchesSearch && matchesStatus && matchesSubject
    })
  }, [teachers, search, statusFilter, subjectFilter])

  // Handlers
  const handleSaveTeacher = (
    teacherData: Omit<Teacher, 'id' | 'currentWeeklyHours'> & { id?: string },
  ) => {
    if (teacherData.id) {
      // Atualizar existente
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacherData.id ? { ...t, ...teacherData } : t)),
      )
    } else {
      // Criar novo
      const newTeacher: Teacher = {
        ...teacherData,
        id: `prof-${Date.now()}`,
        currentWeeklyHours: 0,
      }
      setTeachers((prev) => [newTeacher, ...prev])
    }
  }

  const handleDeleteTeacher = (id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id))
    setDeletingTeacher(null)
  }

  const handleToggleStatus = (teacher: Teacher) => {
    const nextStatus = teacher.status === 'ativo' ? 'inativo' : 'ativo'
    setTeachers((prev) =>
      prev.map((t) => (t.id === teacher.id ? { ...t, status: nextStatus } : t)),
    )
  }

  return (
    <>
      <PageHeader
        title="Professores"
        description="Gerencie os docentes cadastrados, suas disciplinas associadas e a carga horária semanal máxima."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingTeacher(null)
              setIsDialogOpen(true)
            }}
          >
            + Novo professor
          </Button>
        }
      />

      {/* Cards de Métricas */}
      <section className="mb-7">
        <StatGrid>
          <StatCard label="Total de professores" value={stats.total} suffix="cadastrados" />
          <StatCard label="Docentes ativos" value={stats.active} tone="success" suffix={`de ${stats.total}`} />
          <StatCard label="Horas alocadas" value={`${stats.totalHours}h`} suffix="semanais" />
          <StatCard label="Média por docente" value={`${stats.avgHours}h`} suffix="/ semana" />
        </StatGrid>
      </section>

      {/* Tabela e Filtros */}
      <section>
        <SectionHeader title={`Docentes (${filteredTeachers.length})`} />

        {/* Barra de Filtros */}
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3.5 shadow-xs">
          <div className="min-w-[220px] flex-1">
            <FormField
              label="Buscar professor"
              placeholder="Nome, e-mail ou disciplina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="w-36">
            <SelectField
              label="Status"
              options={['todos', 'ativos', 'inativos'] as const}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>

          <div className="w-48">
            <SelectField
              label="Disciplina"
              options={['todas', ...availableSubjectsList] as const}
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            />
          </div>

          {(search || statusFilter !== 'todos' || subjectFilter !== 'todas') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch('')
                setStatusFilter('todos')
                setSubjectFilter('todas')
              }}
              className="h-[42px]"
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Tabela de Professores */}
        <DataTable
          caption="Lista de professores"
          rows={filteredTeachers}
          rowKey={(row) => row.id}
          columns={[
            {
              header: 'Professor',
              cell: (row) => (
                <div>
                  <p className="font-semibold text-ink">{row.name}</p>
                  <p className="text-xs text-muted">{row.email}</p>
                </div>
              ),
            },
            {
              header: 'Disciplinas',
              cell: (row) => (
                <div className="flex flex-wrap gap-1">
                  {row.subjects.map((sub) => (
                    <span
                      key={sub}
                      className="rounded border border-line-soft bg-paper px-2 py-0.5 text-xs font-medium text-ink"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              ),
            },
            {
              header: 'Carga semanal',
              cell: (row) => {
                const percentage = Math.min(
                  100,
                  Math.round((row.currentWeeklyHours / row.maxWeeklyHours) * 100),
                )
                return (
                  <div className="w-36">
                    <div className="flex justify-between text-xs mb-1 font-mono">
                      <span>{row.currentWeeklyHours}h</span>
                      <span className="text-muted">máx {row.maxWeeklyHours}h</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-line-soft overflow-hidden">
                      <div
                        className={
                          percentage >= 90
                            ? 'h-full bg-warning transition-all'
                            : 'h-full bg-primary transition-all'
                        }
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              },
            },
            {
              header: 'Status',
              cell: (row) => (
                <span
                  className={
                    row.status === 'ativo'
                      ? 'inline-flex items-center gap-1 rounded-full border border-primary-soft-line bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary'
                      : 'inline-flex items-center gap-1 rounded-full border border-line-soft bg-paper px-2.5 py-0.5 text-xs font-medium text-muted'
                  }
                >
                  <span
                    className={
                      row.status === 'ativo'
                        ? 'h-1.5 w-1.5 rounded-full bg-primary'
                        : 'h-1.5 w-1.5 rounded-full bg-muted'
                    }
                  />
                  {row.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              ),
            },
            {
              header: 'Ações',
              cell: (row) => (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingTeacher(row)
                      setIsDialogOpen(true)
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleToggleStatus(row)}
                    title={row.status === 'ativo' ? 'Desativar professor' : 'Ativar professor'}
                  >
                    {row.status === 'ativo' ? 'Desativar' : 'Ativar'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setDeletingTeacher(row)}
                    className="p-1.5 text-muted hover:text-danger transition-colors text-xs"
                    title="Excluir professor"
                  >
                    Excluir
                  </button>
                </div>
              ),
            },
          ]}
        />

        {filteredTeachers.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-line bg-white p-8 text-center">
            <p className="text-sm font-medium text-ink">Nenhum professor encontrado</p>
            <p className="mt-1 text-xs text-muted">Tente ajustar os filtros ou busca por nome/disciplina.</p>
          </div>
        )}
      </section>

      {/* Modal de Criar / Editar */}
      {isDialogOpen && (
        <TeacherDialog
          teacher={editingTeacher}
          onClose={() => {
            setIsDialogOpen(false)
            setEditingTeacher(null)
          }}
          onSave={handleSaveTeacher}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingTeacher && (
        <dialog
          open
          className="m-auto w-[min(400px,calc(100%-2rem))] rounded-lg border border-line bg-white p-6 text-ink shadow-lg backdrop:bg-black/40"
        >
          <h3 className="text-base font-semibold">Excluir Professor</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Tem certeza que deseja remover <strong>{deletingTeacher.name}</strong>? Esta ação não pode ser desfeita na memória local.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingTeacher(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={() => handleDeleteTeacher(deletingTeacher.id)}
            >
              Excluir
            </Button>
          </div>
        </dialog>
      )}
    </>
  )
}
