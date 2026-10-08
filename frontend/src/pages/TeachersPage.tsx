import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import {
  getProfessores,
  createProfessor,
  updateProfessor,
  deleteProfessor,
  type ProfessorBackend,
  type NivelEnsinoType,
} from '@/api/professores'
import {
  getDisciplinas,
  createDisciplina,
  type DisciplinaBackend,
} from '@/api/disciplinas'
import { type NivelEnsino, type Teacher } from '@/mocks/teachers'
import { DeleteTeacherDialog } from './teachers/DeleteTeacherDialog'
import { SubjectDialog } from './teachers/SubjectDialog'
import { TeacherAvailabilityDialog, type SlotState } from './teachers/TeacherAvailabilityDialog'
import { TeacherDialog } from './teachers/TeacherDialog'

export function TeachersPage() {
  const queryClient = useQueryClient()

  // Filtros locais
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [subjectFilter, setSubjectFilter] = useState<string>('todas')
  const [nivelFilter, setNivelFilter] = useState<string>('todos')

  // Modais
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false)
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null)
  const [availabilityTeacher, setAvailabilityTeacher] = useState<Teacher | null>(null)

  // Estado local para horários de disponibilidade salvos por professor (front-end)
  const [teacherAvailabilityMap, setTeacherAvailabilityMap] = useState<
    Record<string, Record<string, SlotState>>
  >({})

  // 1. Queries ao core-service
  const professoresQuery = useQuery({
    queryKey: ['professores'],
    queryFn: () => getProfessores(),
  })

  const disciplinasQuery = useQuery({
    queryKey: ['disciplinas'],
    queryFn: () => getDisciplinas(),
  })

  // Popula o core-service com dados iniciais se o banco em memória estiver vazio
  useEffect(() => {
    if (disciplinasQuery.isSuccess && disciplinasQuery.data.length === 0) {
      const initialSubjects = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Educação Física']
      Promise.all(initialSubjects.map((nome) => createDisciplina({ nome }))).then(() => {
        queryClient.invalidateQueries({ queryKey: ['disciplinas'] })
      })
    }
  }, [disciplinasQuery.isSuccess, disciplinasQuery.data, queryClient])

  useEffect(() => {
    if (
      professoresQuery.isSuccess &&
      professoresQuery.data.length === 0 &&
      disciplinasQuery.isSuccess &&
      disciplinasQuery.data.length > 0
    ) {
      const discMap = new Map(disciplinasQuery.data.map((d) => [d.nome, d.id!]))
      const initialProfs: Omit<ProfessorBackend, 'id'>[] = [
        {
          nome: 'Ana Ferreira',
          email: 'ana.ferreira@escola.gov.br',
          niveis_ensino: ['Anos Finais', 'Ensino Médio'],
          disciplinas: [discMap.get('Matemática')].filter(Boolean) as number[],
          carga_maxima_aulas: 20,
          ativo: true,
        },
        {
          nome: 'Carlos Lima',
          email: 'carlos.lima@escola.gov.br',
          niveis_ensino: ['Ensino Médio'],
          disciplinas: [discMap.get('Português')].filter(Boolean) as number[],
          carga_maxima_aulas: 20,
          ativo: true,
        },
        {
          nome: 'Beatriz Souza',
          email: 'beatriz.souza@escola.gov.br',
          niveis_ensino: ['Anos Finais'],
          disciplinas: [discMap.get('Ciências')].filter(Boolean) as number[],
          carga_maxima_aulas: 16,
          ativo: true,
        },
        {
          nome: 'João Prado',
          email: 'joao.prado@escola.gov.br',
          niveis_ensino: ['Anos Finais', 'Ensino Médio'],
          disciplinas: [discMap.get('História')].filter(Boolean) as number[],
          carga_maxima_aulas: 20,
          ativo: true,
        },
        {
          nome: 'Marina Alves',
          email: 'marina.alves@escola.gov.br',
          niveis_ensino: ['Anos Iniciais', 'Anos Finais'],
          disciplinas: [discMap.get('Educação Física')].filter(Boolean) as number[],
          carga_maxima_aulas: 12,
          ativo: true,
        },
        {
          nome: 'Roberto Mendes',
          email: 'roberto.mendes@escola.gov.br',
          niveis_ensino: ['Anos Finais'],
          disciplinas: [discMap.get('Geografia')].filter(Boolean) as number[],
          carga_maxima_aulas: 20,
          ativo: false,
        },
      ]

      Promise.all(initialProfs.map((p) => createProfessor(p))).then(() => {
        queryClient.invalidateQueries({ queryKey: ['professores'] })
      })
    }
  }, [professoresQuery.isSuccess, professoresQuery.data, disciplinasQuery.isSuccess, disciplinasQuery.data, queryClient])

  // 2. Mapeamentos de Disciplinas
  const disciplinesList = useMemo(() => {
    return (disciplinasQuery.data ?? []).map((d) => d.nome)
  }, [disciplinasQuery.data])

  const disciplineIdByName = useMemo(() => {
    const map = new Map<string, number>()
    ;(disciplinasQuery.data ?? []).forEach((d) => {
      if (d.id) map.set(d.nome.toLowerCase(), d.id)
    })
    return map
  }, [disciplinasQuery.data])

  const disciplineNameById = useMemo(() => {
    const map = new Map<number, string>()
    ;(disciplinasQuery.data ?? []).forEach((d) => {
      if (d.id) map.set(d.id, d.nome)
    })
    return map
  }, [disciplinasQuery.data])

  // 3. Mapeamento de Backend Professors para UI Teachers
  const teachers: (Teacher & { raw: ProfessorBackend })[] = useMemo(() => {
    const backendList = professoresQuery.data ?? []
    return backendList.map((p) => {
      const subjectNames = (p.disciplinas ?? []).map(
        (id) => disciplineNameById.get(id) ?? `Disciplina ${id}`,
      )

      return {
        id: String(p.id),
        name: p.nome,
        email: p.email,
        niveisEnsino: (p.niveis_ensino && p.niveis_ensino.length > 0
          ? p.niveis_ensino
          : ['Anos Finais']) as NivelEnsino[],
        subjects: subjectNames,
        maxWeeklyHours: p.carga_maxima_aulas,
        currentWeeklyHours: Math.min(p.carga_maxima_aulas, Math.round(p.carga_maxima_aulas * 0.75)),
        status: p.ativo ? 'ativo' : 'inativo',
        raw: p,
      }
    })
  }, [professoresQuery.data, disciplineNameById])

  // 4. Mutations do React Query
  const createProfessorMutation = useMutation({
    mutationFn: createProfessor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['professores'] }),
  })

  const updateProfessorMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProfessorBackend }) =>
      updateProfessor(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['professores'] }),
  })

  const deleteProfessorMutation = useMutation({
    mutationFn: deleteProfessor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['professores'] }),
  })

  const createDisciplinaMutation = useMutation({
    mutationFn: (nome: string) => createDisciplina({ nome }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['disciplinas'] }),
  })

  // 5. Estatísticas
  const stats = useMemo(() => {
    const total = teachers.length
    const active = teachers.filter((t) => t.status === 'ativo').length
    const totalHours = teachers.reduce((acc, t) => acc + t.currentWeeklyHours, 0)
    const avgHours = active > 0 ? (totalHours / active).toFixed(1) : '0'

    return { total, active, totalHours, avgHours }
  }, [teachers])

  // 6. Filtragem da tabela
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

      const matchesNivel =
        nivelFilter === 'todos'
          ? true
          : teacher.niveisEnsino.includes(nivelFilter as NivelEnsino)

      return matchesSearch && matchesStatus && matchesSubject && matchesNivel
    })
  }, [teachers, search, statusFilter, subjectFilter, nivelFilter])

  // 7. Handlers assíncronos integrados com o core-service
  const handleAddSubject = async (newSubjectName: string) => {
    const trimmed = newSubjectName.trim()
    if (!trimmed) return
    const exists = disciplineIdByName.has(trimmed.toLowerCase())
    if (!exists) {
      await createDisciplinaMutation.mutateAsync(trimmed)
    }
  }

  const handleSaveTeacher = async (
    teacherData: Omit<Teacher, 'id' | 'currentWeeklyHours'> & { id?: string },
  ) => {
    const disciplineIds: number[] = []
    const currentDisciplinesData = queryClient.getQueryData<DisciplinaBackend[]>(['disciplinas']) ?? []
    const currentMap = new Map(currentDisciplinesData.map((d) => [d.nome.toLowerCase(), d.id!]))

    for (const subName of teacherData.subjects) {
      const existingId = currentMap.get(subName.toLowerCase())
      if (existingId) {
        disciplineIds.push(existingId)
      } else {
        const newDisc = await createDisciplina({ nome: subName })
        if (newDisc.id) disciplineIds.push(newDisc.id)
      }
    }

    const payload: ProfessorBackend = {
      id: teacherData.id ? Number(teacherData.id) : undefined,
      nome: teacherData.name,
      email: teacherData.email,
      niveis_ensino: teacherData.niveisEnsino as NivelEnsinoType[],
      disciplinas: disciplineIds,
      carga_maxima_aulas: teacherData.maxWeeklyHours,
      ativo: teacherData.status === 'ativo',
    }

    if (teacherData.id) {
      await updateProfessorMutation.mutateAsync({
        id: Number(teacherData.id),
        payload,
      })
    } else {
      await createProfessorMutation.mutateAsync(payload)
    }
  }

  const handleDeleteTeacher = async (id: string) => {
    await deleteProfessorMutation.mutateAsync(Number(id))
    setDeletingTeacher(null)
  }

  const handleToggleStatus = async (teacher: Teacher & { raw: ProfessorBackend }) => {
    const updatedPayload: ProfessorBackend = {
      ...teacher.raw,
      ativo: !teacher.raw.ativo,
    }
    await updateProfessorMutation.mutateAsync({
      id: Number(teacher.id),
      payload: updatedPayload,
    })
  }

  const isLoading = professoresQuery.isLoading || disciplinasQuery.isLoading

  return (
    <>
      <PageHeader
        title="Professores"
        description="Gerencie os docentes cadastrados, níveis de ensino, disciplinas associadas e carga horária semanal."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSubjectDialogOpen(true)}
            >
              + Nova disciplina
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingTeacher(null)
                setIsTeacherDialogOpen(true)
              }}
            >
              + Novo professor
            </Button>
          </div>
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
          <div className="min-w-[200px] flex-1">
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

          <div className="w-40">
            <SelectField
              label="Nível de Ensino"
              options={['todos', 'Anos Iniciais', 'Anos Finais', 'Ensino Médio'] as const}
              value={nivelFilter}
              onChange={(e) => setNivelFilter(e.target.value)}
            />
          </div>

          <div className="w-44">
            <SelectField
              label="Disciplina"
              options={['todas', ...disciplinesList] as const}
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            />
          </div>

          {(search || statusFilter !== 'todos' || subjectFilter !== 'todas' || nivelFilter !== 'todos') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch('')
                setStatusFilter('todos')
                setSubjectFilter('todas')
                setNivelFilter('todos')
              }}
              className="h-[42px]"
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Indicador de Carregamento */}
        {isLoading && (
          <div className="my-6 text-center text-sm text-muted">
            Carregando professores do core-service…
          </div>
        )}

        {/* Tabela de Professores */}
        {!isLoading && (
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
                header: 'Níveis de Ensino',
                cell: (row) => (
                  <div className="flex flex-wrap gap-1">
                    {(row.niveisEnsino ?? ['Anos Finais']).map((n) => (
                      <span
                        key={n}
                        className="inline-block rounded border border-line-soft bg-paper px-2 py-0.5 text-xs font-semibold text-ink whitespace-nowrap"
                      >
                        {n}
                      </span>
                    ))}
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
                        className="rounded border border-primary-soft-line bg-primary-soft/40 px-2 py-0.5 text-xs font-medium text-primary"
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
                    <div className="w-32">
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
                      onClick={() => setAvailabilityTeacher(row)}
                      title="Gerenciar horários de disponibilidade"
                    >
                      Horários
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingTeacher(row)
                        setIsTeacherDialogOpen(true)
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
        )}

        {!isLoading && filteredTeachers.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-line bg-white p-8 text-center">
            <p className="text-sm font-medium text-ink">Nenhum professor encontrado</p>
            <p className="mt-1 text-xs text-muted">Tente ajustar os filtros ou cadastrar um novo professor.</p>
          </div>
        )}
      </section>

      {/* Modal de Horários de Disponibilidade (Front-end) */}
      {availabilityTeacher && (
        <TeacherAvailabilityDialog
          teacher={availabilityTeacher}
          initialSlots={teacherAvailabilityMap[availabilityTeacher.id]}
          onClose={() => setAvailabilityTeacher(null)}
          onSave={(slots) => {
            setTeacherAvailabilityMap((prev) => ({
              ...prev,
              [availabilityTeacher.id]: slots,
            }))
          }}
        />
      )}

      {/* Modal de Criar / Editar Professor */}
      {isTeacherDialogOpen && (
        <TeacherDialog
          teacher={editingTeacher}
          availableSubjects={disciplinesList}
          onAddSubject={handleAddSubject}
          onClose={() => {
            setIsTeacherDialogOpen(false)
            setEditingTeacher(null)
          }}
          onSave={handleSaveTeacher}
        />
      )}

      {/* Modal de Criar Nova Disciplina (Avulso) */}
      {isSubjectDialogOpen && (
        <SubjectDialog
          availableSubjects={disciplinesList}
          onAddSubject={handleAddSubject}
          onClose={() => setIsSubjectDialogOpen(false)}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingTeacher && (
        <DeleteTeacherDialog
          teacher={deletingTeacher}
          onClose={() => setDeletingTeacher(null)}
          onConfirm={() => handleDeleteTeacher(deletingTeacher.id)}
        />
      )}
    </>
  )
}
