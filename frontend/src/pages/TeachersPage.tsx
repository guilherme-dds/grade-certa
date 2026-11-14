import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { CompactSelect, QuickFilters, SearchInput, Toolbar } from '@/components/ui/FilterBar'
import { RowMenu } from '@/components/ui/RowMenu'
import { TabHeader } from '@/layouts/SectionLayout'
import { cn } from '@/lib/cn'
import {
  getProfessores,
  createProfessor,
  updateProfessor,
  deleteProfessor,
  type ProfessorBackend,
  type NivelEnsinoType,
} from '@/api/professores'
import { getDisciplinas, createDisciplina, type DisciplinaBackend } from '@/api/disciplinas'
import { getJornadaPadrao, type Jornada } from '@/api/configuracoes'
import { getTurmas, type TurmaBackend } from '@/api/turmas'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { atribuirProfessor, descreverVagas, vagasParaProfessor } from '@/lib/matrizVagas'
import { formatDateTime, niveisEnsino } from '@/lib/schedule'
import { type NivelEnsino, type Teacher, type TeacherRow } from './teachers/types'
import { DeleteTeacherDialog } from './teachers/DeleteTeacherDialog'
import { resumoJornada } from './teachers/jornada'
import { TeacherAvailabilityDialog } from './teachers/TeacherAvailabilityDialog'
import { TeacherDialog } from './teachers/TeacherDialog'

// Até a resposta do core-service chegar (mesmos valores do padrão do backend)
const JORNADA_INICIAL: Jornada = {
  almoco_inicio: '11:30',
  almoco_fim: '14:30',
  almoco_minutos: 40,
  max_aulas_dia: 8,
  max_horas_dia: 9,
}

export function TeachersPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  // Filtros locais
  const [search, setSearch] = useState('')
  // O filtro de situação fica na URL: ?filtro=sem-disponibilidade vem do dashboard e do gerador
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = (searchParams.get('filtro') ?? 'todos').replace(/-/g, ' ')
  const setStatusFilter = (value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'todos') next.delete('filtro')
        else next.set('filtro', value.replace(/ /g, '-'))
        return next
      },
      { replace: true },
    )
  const [subjectFilter, setSubjectFilter] = useState<string>('todas')
  const [nivelFilter, setNivelFilter] = useState<string>('todos')

  // Modais
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null)
  const [availabilityTeacher, setAvailabilityTeacher] = useState<TeacherRow | null>(null)

  // 1. Queries ao core-service
  const professoresQuery = useQuery({
    queryKey: ['professores'],
    queryFn: () => getProfessores(),
  })

  const disciplinasQuery = useQuery({
    queryKey: ['disciplinas'],
    queryFn: () => getDisciplinas(),
  })

  const turmasQuery = useQuery({
    queryKey: ['turmas'],
    queryFn: getTurmas,
  })

  const jornadaPadrao = useQuery({ queryKey: ['jornadaPadrao'], queryFn: getJornadaPadrao }).data ?? JORNADA_INICIAL

  // Aulas semanais atribuídas a cada professor nas matrizes curriculares (vínculo pelo id)
  const aulasPorProfessor = useMemo(() => {
    const map = new Map<number, number>()
    for (const turma of turmasQuery.data ?? []) {
      for (const item of turma.matriz_curricular ?? []) {
        for (const id of item.professor_ids ?? []) {
          map.set(id, (map.get(id) ?? 0) + Number(item.aulas_semanais || 0))
        }
      }
    }
    return map
  }, [turmasQuery.data])

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
  const teachers: TeacherRow[] = useMemo(() => {
    const backendList = professoresQuery.data ?? []
    return backendList.map((p) => {
      const subjectNames = (p.disciplinas ?? []).map((id) => disciplineNameById.get(id) ?? `Disciplina ${id}`)

      return {
        id: String(p.id),
        name: p.nome,
        email: p.email,
        niveisEnsino: (p.niveis_ensino && p.niveis_ensino.length > 0
          ? p.niveis_ensino
          : ['Anos Finais']) as NivelEnsino[],
        subjects: subjectNames,
        maxWeeklyHours: p.carga_maxima_aulas,
        currentWeeklyHours: (p.id ? aulasPorProfessor.get(p.id) : undefined) ?? 0,
        status: p.ativo ? 'ativo' : 'inativo',
        jornada: p.jornada ?? null,
        raw: p,
      }
    })
  }, [professoresQuery.data, disciplineNameById, aulasPorProfessor])

  // 4. Mutations do React Query
  const createProfessorMutation = useMutation({
    mutationFn: createProfessor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['professores'] }),
  })

  const updateProfessorMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProfessorBackend }) => updateProfessor(id, payload),
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

  // 5. Contagens dos filtros rápidos
  const semDisponibilidade = (t: TeacherRow) => t.status === 'ativo' && !t.raw.disponibilidade_atualizada_em
  const acimaDaCarga = (t: TeacherRow) => t.status === 'ativo' && t.currentWeeklyHours > t.maxWeeklyHours
  const counts = {
    todos: teachers.length,
    semDisponibilidade: teachers.filter(semDisponibilidade).length,
    acimaDaCarga: teachers.filter(acimaDaCarga).length,
    inativos: teachers.filter((t) => t.status === 'inativo').length,
  }

  // 6. Filtragem da tabela
  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      const matchesSearch =
        teacher.name.toLowerCase().includes(search.toLowerCase()) ||
        teacher.email.toLowerCase().includes(search.toLowerCase()) ||
        teacher.subjects.some((s) => s.toLowerCase().includes(search.toLowerCase()))

      const matchesStatus =
        statusFilter === 'sem disponibilidade'
          ? semDisponibilidade(teacher)
          : statusFilter === 'acima da carga'
            ? acimaDaCarga(teacher)
            : statusFilter === 'inativos'
              ? teacher.status === 'inativo'
              : true

      const matchesSubject = subjectFilter === 'todas' ? true : teacher.subjects.includes(subjectFilter)

      const matchesNivel = nivelFilter === 'todos' ? true : teacher.niveisEnsino.includes(nivelFilter as NivelEnsino)

      return matchesSearch && matchesStatus && matchesSubject && matchesNivel
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSaveTeacher = async (teacherData: Omit<Teacher, 'id' | 'currentWeeklyHours'> & { id?: string }) => {
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
      jornada: teacherData.jornada,
    }

    const salvo = teacherData.id
      ? await updateProfessorMutation.mutateAsync({ id: Number(teacherData.id), payload })
      : await createProfessorMutation.mutateAsync(payload)

    // Sem esperar: o painel fecha e a pergunta aparece em seguida, sobre a lista
    if (salvo.id != null && payload.ativo)
      void oferecerVagas(salvo.id, salvo.nome, teacherData.subjects, payload.niveis_ensino)
  }

  /**
   * Ter a disciplina no cadastro não coloca o professor nas turmas: quem dá cada aula é definido
   * na matriz da turma. Se houver aula dessas disciplinas sem professor, oferece preencher.
   */
  const oferecerVagas = async (id: number, nome: string, disciplinas: string[], niveis: string[] = []) => {
    const turmasAtuais = queryClient.getQueryData<TurmaBackend[]>(['turmas']) ?? []
    const vagas = vagasParaProfessor(turmasAtuais, disciplinas, niveis)
    if (vagas.length === 0) return
    const ok = await confirm({
      title: `Colocar ${nome} nas turmas?`,
      description: `${descreverVagas(vagas)} ${vagas.length === 1 ? 'está' : 'estão'} sem professor na matriz curricular. Sem professor, essas aulas ficam fora da grade.`,
      confirmLabel: vagas.length === 1 ? 'Atribuir' : `Atribuir nas ${vagas.length}`,
      cancelLabel: 'Agora não',
    })
    if (!ok) return
    await atribuirProfessor(vagas, id)
    await queryClient.invalidateQueries({ queryKey: ['turmas'] })
  }

  const handleDeleteTeacher = async (id: string) => {
    await deleteProfessorMutation.mutateAsync(Number(id))
    setDeletingTeacher(null)
  }

  const handleToggleStatus = async (teacher: TeacherRow) => {
    const updatedPayload: ProfessorBackend = {
      ...teacher.raw,
      ativo: !teacher.raw.ativo,
    }
    await updateProfessorMutation.mutateAsync({
      id: Number(teacher.id),
      payload: updatedPayload,
    })
  }

  const isLoading = professoresQuery.isLoading || disciplinasQuery.isLoading || turmasQuery.isLoading

  const hasFilters = search || statusFilter !== 'todos' || subjectFilter !== 'todas' || nivelFilter !== 'todos'
  const clearFilters = () => {
    setSearch('')
    setStatusFilter('todos')
    setSubjectFilter('todas')
    setNivelFilter('todos')
  }
  const openNew = () => {
    setEditingTeacher(null)
    setIsTeacherDialogOpen(true)
  }

  return (
    <>
      <TabHeader
        title="Professores"
        description="Quem dá aula, em quais disciplinas e níveis, e quando cada um não pode dar aula."
        actions={<Button onClick={openNew}>Novo professor</Button>}
      />

      <QuickFilters
        label="Mostrar professores"
        value={statusFilter}
        onChange={setStatusFilter}
        filters={[
          { value: 'todos', label: 'Todos', count: counts.todos },
          {
            value: 'sem disponibilidade',
            label: 'Sem disponibilidade',
            count: counts.semDisponibilidade,
            attention: true,
          },
          { value: 'acima da carga', label: 'Acima da carga', count: counts.acimaDaCarga, attention: true },
          { value: 'inativos', label: 'Inativos', count: counts.inativos },
        ]}
      />

      <div className="mt-3">
        <Toolbar>
          <SearchInput
            label="Buscar professor"
            placeholder="Buscar por nome, e-mail ou disciplina"
            value={search}
            onChange={setSearch}
          />
          <CompactSelect
            label="Nível"
            value={nivelFilter}
            onChange={setNivelFilter}
            options={[{ value: 'todos', label: 'Todos' }, ...niveisEnsino.map((n) => ({ value: n, label: n }))]}
          />
          <CompactSelect
            label="Disciplina"
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={[{ value: 'todas', label: 'Todas' }, ...disciplinesList.map((d) => ({ value: d, label: d }))]}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-10 rounded-full px-3 text-[13.5px] font-semibold text-muted hover:bg-white hover:text-ink"
            >
              Limpar
            </button>
          )}
        </Toolbar>
      </div>

      {isLoading ? (
        <p className="my-6 text-center text-sm text-muted">Carregando professores…</p>
      ) : filteredTeachers.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-line bg-white/60 p-10 text-center">
          {teachers.length === 0 ? (
            <>
              <p className="font-semibold">Nenhum professor cadastrado</p>
              <p className="mt-1 text-[14px] text-muted">Cadastre os professores com as disciplinas que cada um dá.</p>
              <Button onClick={openNew} className="mt-4">
                Cadastrar primeiro professor
              </Button>
            </>
          ) : (
            <>
              <p className="font-semibold">Nenhum professor com esses filtros</p>
              <Button variant="secondary" onClick={clearFilters} className="mt-4">
                Limpar filtros
              </Button>
            </>
          )}
        </div>
      ) : (
        <DataTable
          caption="Professores"
          rows={filteredTeachers}
          rowKey={(row) => row.id}
          columns={[
            {
              header: 'Professor',
              cell: (row) => (
                <div className={cn('min-w-[180px]', row.status === 'inativo' && 'opacity-55')}>
                  <p className="font-semibold">
                    {row.name}
                    {row.status === 'inativo' && (
                      <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-[11.5px] font-semibold text-muted">
                        Inativo
                      </span>
                    )}
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {[(row.niveisEnsino ?? []).join(', '), row.email].filter(Boolean).join(' · ')}
                  </p>
                  {row.jornada && (
                    <p
                      className="mt-1 inline-flex rounded-full bg-lilac-soft px-2 py-0.5 text-[11.5px] font-semibold"
                      title={resumoJornada(row.jornada)}
                    >
                      Jornada própria
                    </p>
                  )}
                </div>
              ),
            },
            {
              header: 'Disciplinas',
              cell: (row) => {
                const shown = row.subjects.slice(0, 3)
                const rest = row.subjects.length - shown.length
                return (
                  <div className="flex max-w-[260px] flex-wrap gap-1" title={row.subjects.join(', ')}>
                    {shown.map((sub) => (
                      <span key={sub} className="rounded-full bg-paper px-2.5 py-0.5 text-[12.5px] font-medium">
                        {sub}
                      </span>
                    ))}
                    {rest > 0 && <span className="px-1 py-0.5 text-[12.5px] font-medium text-muted">+{rest}</span>}
                  </div>
                )
              },
            },
            {
              header: 'Carga semanal',
              cell: (row) => {
                const over = row.currentWeeklyHours > row.maxWeeklyHours
                const pct = Math.min(100, Math.round((row.currentWeeklyHours / Math.max(1, row.maxWeeklyHours)) * 100))
                return (
                  <div className="w-36">
                    <p className="mb-1 text-[13px] tabular-nums">
                      <span className={cn('font-semibold', over && 'text-danger')}>{row.currentWeeklyHours}</span>
                      <span className="text-muted"> de {row.maxWeeklyHours} aulas</span>
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          over ? 'bg-danger' : pct >= 90 ? 'bg-warning' : 'bg-accent',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              },
            },
            {
              header: 'Disponibilidade',
              cell: (row) =>
                row.raw.disponibilidade_atualizada_em ? (
                  <span
                    className="inline-flex rounded-full bg-primary-soft px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap text-primary"
                    title={`Registrada em ${formatDateTime(row.raw.disponibilidade_atualizada_em)}`}
                  >
                    Registrada
                  </span>
                ) : (
                  <span
                    className="inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap text-warning"
                    title="Sem registro, o gerador considera a semana toda livre"
                  >
                    Não registrada
                  </span>
                ),
            },
            {
              header: 'Ações',
              className: 'text-right',
              cell: (row) => (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant={
                      row.raw.disponibilidade_atualizada_em || row.status === 'inativo' ? 'secondary' : 'primary'
                    }
                    size="sm"
                    onClick={() => setAvailabilityTeacher(row)}
                  >
                    Disponibilidade
                  </Button>
                  <RowMenu
                    label={`Mais ações para ${row.name}`}
                    items={[
                      {
                        label: 'Editar cadastro',
                        onSelect: () => {
                          setEditingTeacher(row)
                          setIsTeacherDialogOpen(true)
                        },
                      },
                      {
                        label: row.status === 'ativo' ? 'Desativar' : 'Reativar',
                        onSelect: () => handleToggleStatus(row),
                      },
                      { label: 'Excluir', danger: true, onSelect: () => setDeletingTeacher(row) },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Modal de Horários de Disponibilidade (salvos no core-service) */}
      {availabilityTeacher && (
        <TeacherAvailabilityDialog professor={availabilityTeacher.raw} onClose={() => setAvailabilityTeacher(null)} />
      )}

      {/* Modal de Criar / Editar Professor */}
      {isTeacherDialogOpen && (
        <TeacherDialog
          teacher={editingTeacher}
          availableSubjects={disciplinesList}
          jornadaPadrao={jornadaPadrao}
          onAddSubject={handleAddSubject}
          onClose={() => {
            setIsTeacherDialogOpen(false)
            setEditingTeacher(null)
          }}
          onSave={handleSaveTeacher}
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
