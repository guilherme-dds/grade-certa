import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader'
import {
  getTurmas,
  createTurma,
  updateTurma,
  deleteTurma,
  type TurmaBackend,
  type ItemMatriz,
} from '@/api/turmas'
import { getProfessores } from '@/api/professores'
import { getDisciplinas } from '@/api/disciplinas'
import {
  getSalas,
  createSala,
  updateSala,
  deleteSala,
  type SalaBackend,
} from '@/api/salas'
import { SalaDialog } from './salas/SalaDialog'
import { DeleteSalaDialog } from './salas/DeleteSalaDialog'
import { SalaIndisponibilidadeDialog } from './salas/SalaIndisponibilidadeDialog'
import { TurmaDialog } from './turmas/TurmaDialog'
import { DeleteTurmaDialog } from './turmas/DeleteTurmaDialog'
import {
  CurriculumMatrixDialog,
  type TeacherWithSubjects,
} from './turmas/CurriculumMatrixDialog'

export function SubjectsPage() {
  const queryClient = useQueryClient()

  // Estados dos modais
  const [isTurmaDialogOpen, setIsTurmaDialogOpen] = useState(false)
  const [editingTurma, setEditingTurma] = useState<TurmaBackend | null>(null)
  const [deletingTurma, setDeletingTurma] = useState<TurmaBackend | null>(null)
  const [matrixTurma, setMatrixTurma] = useState<TurmaBackend | null>(null)
  const [isSalaDialogOpen, setIsSalaDialogOpen] = useState(false)
  const [editingSala, setEditingSala] = useState<SalaBackend | null>(null)
  const [deletingSala, setDeletingSala] = useState<SalaBackend | null>(null)
  const [horariosSalaId, setHorariosSalaId] = useState<number | null>(null)

  // 1. Query das Turmas ao core-service
  const turmasQuery = useQuery({
    queryKey: ['turmas'],
    queryFn: getTurmas,
  })

  const salasQuery = useQuery({
    queryKey: ['salas'],
    queryFn: getSalas,
  })

  // 2. Query dos Professores e Disciplinas
  const professoresQuery = useQuery({
    queryKey: ['professores'],
    queryFn: () => getProfessores(),
  })

  const disciplinasQuery = useQuery({
    queryKey: ['disciplinas'],
    queryFn: () => getDisciplinas(),
  })

  const availableSubjects = useMemo(() => {
    return (disciplinasQuery.data ?? []).map((d) => d.nome)
  }, [disciplinasQuery.data])

  // Mapeia cada docente para suas disciplinas cadastradas
  const teachersWithSubjects = useMemo<TeacherWithSubjects[]>(() => {
    const discMap = new Map<number, string>()
    ;(disciplinasQuery.data ?? []).forEach((d) => {
      if (d.id) discMap.set(d.id, d.nome)
    })

    const map: Record<string, string[]> = {
      'Ana Ferreira': ['Matemática'],
      'Carlos Lima': ['Português'],
      'Beatriz Souza': ['Ciências'],
      'João Prado': ['História'],
      'Marina Alves': ['Educação Física'],
      'Roberto Mendes': ['Geografia'],
    }

    ;(professoresQuery.data ?? []).forEach((p) => {
      const subs = (p.disciplinas ?? [])
        .map((id) => discMap.get(id))
        .filter((n): n is string => Boolean(n))
      if (subs.length > 0) {
        map[p.nome] = subs
      }
    })

    return Object.entries(map).map(([name, subjects]) => ({
      name,
      subjects,
    }))
  }, [professoresQuery.data, disciplinasQuery.data])

  // Se o banco estiver vazio, popula com turmas e matrizes iniciais
  useEffect(() => {
    if (turmasQuery.isSuccess && turmasQuery.data.length === 0) {
      const initialTurmas: Omit<TurmaBackend, 'id'>[] = [
        {
          nome: '6º Ano A',
          turno: 'Manhã',
          matriz_curricular: [
            { disciplina: 'Matemática', aulas_semanais: 5, professor: 'Ana Ferreira' },
            { disciplina: 'Português', aulas_semanais: 5, professor: 'Carlos Lima' },
            { disciplina: 'Ciências', aulas_semanais: 4, professor: 'Beatriz Souza' },
            { disciplina: 'História', aulas_semanais: 3, professor: 'João Prado' },
            { disciplina: 'Educação Física', aulas_semanais: 2, professor: 'Marina Alves' },
          ],
        },
        {
          nome: '6º Ano B',
          turno: 'Tarde',
          matriz_curricular: [
            { disciplina: 'Matemática', aulas_semanais: 5, professor: 'Ana Ferreira' },
            { disciplina: 'Português', aulas_semanais: 5, professor: 'Carlos Lima' },
            { disciplina: 'Ciências', aulas_semanais: 4, professor: 'Beatriz Souza' },
          ],
        },
        {
          nome: '7º Ano A',
          turno: 'Manhã',
          matriz_curricular: [
            { disciplina: 'Matemática', aulas_semanais: 5, professor: 'Ana Ferreira' },
            { disciplina: 'Português', aulas_semanais: 5, professor: 'Carlos Lima' },
            { disciplina: 'História', aulas_semanais: 3, professor: 'João Prado' },
          ],
        },
        { nome: '8º Ano A', turno: 'Manhã', matriz_curricular: [] },
        { nome: '9º Ano A', turno: 'Manhã', matriz_curricular: [] },
      ]

      Promise.all(initialTurmas.map((t) => createTurma(t))).then(() => {
        queryClient.invalidateQueries({ queryKey: ['turmas'] })
      })
    }
  }, [turmasQuery.isSuccess, turmasQuery.data, queryClient])

  // Mutations
  const createTurmaMutation = useMutation({
    mutationFn: createTurma,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['turmas'] }),
  })

  const updateTurmaMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TurmaBackend }) =>
      updateTurma(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['turmas'] }),
  })

  const deleteTurmaMutation = useMutation({
    mutationFn: deleteTurma,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['turmas'] }),
  })

  const handleSaveTurma = async (data: Omit<TurmaBackend, 'id'> & { id?: number }) => {
    if (data.id) {
      const existing = turmasQuery.data?.find((t) => t.id === data.id)
      await updateTurmaMutation.mutateAsync({
        id: data.id,
        payload: {
          id: data.id,
          nome: data.nome,
          turno: data.turno,
          matriz_curricular: existing?.matriz_curricular ?? [],
        },
      })
    } else {
      await createTurmaMutation.mutateAsync({
        nome: data.nome,
        turno: data.turno,
        matriz_curricular: [],
      })
    }
  }

  const handleSaveMatrix = async (matriz: ItemMatriz[]) => {
    if (!matrixTurma || !matrixTurma.id) return
    await updateTurmaMutation.mutateAsync({
      id: matrixTurma.id,
      payload: {
        ...matrixTurma,
        matriz_curricular: matriz,
      },
    })
    setMatrixTurma(null)
  }

  const handleDeleteTurma = async (id: number) => {
    await deleteTurmaMutation.mutateAsync(id)
    setDeletingTurma(null)
  }

  const createSalaMutation = useMutation({
    mutationFn: createSala,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salas'] }),
  })

  const updateSalaMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SalaBackend }) =>
      updateSala(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salas'] }),
  })

  const deleteSalaMutation = useMutation({
    mutationFn: deleteSala,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salas'] }),
  })

  const handleSaveSala = async ({ id, ...data }: Omit<SalaBackend, 'id'> & { id?: number }) => {
    if (id) {
      await updateSalaMutation.mutateAsync({ id, payload: { id, ...data } })
    } else {
      await createSalaMutation.mutateAsync(data)
    }
  }

  // Lido da query para refletir os horários adicionados/removidos sem fechar o modal
  const horariosSala = salasQuery.data?.find((s) => s.id === horariosSalaId) ?? null

  const handleDeleteSala = async (id: number) => {
    await deleteSalaMutation.mutateAsync(id)
    setDeletingSala(null)
  }

  const isLoading = turmasQuery.isLoading

  return (
    <>
      <PageHeader
        title="Turmas e salas"
        description="Gerencie as turmas ativas, matrizes curriculares com carga horária por matéria, docentes e salas."
      />

      {/* Seção de Turmas */}
      <section className="mb-8">
        <SectionHeader
          title={`Turmas (${turmasQuery.data?.length ?? 0})`}
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditingTurma(null)
                setIsTurmaDialogOpen(true)
              }}
            >
              + Nova turma
            </Button>
          }
        />

        {isLoading && (
          <div className="my-6 text-center text-sm text-muted">
            Carregando turmas...
          </div>
        )}

        {!isLoading && (
          <DataTable
            caption="Lista de Turmas"
            rows={turmasQuery.data ?? []}
            rowKey={(row) => String(row.id ?? row.nome)}
            columns={[
              {
                header: 'Turma',
                cell: (row) => <span className="font-semibold text-ink">{row.nome}</span>,
              },
              {
                header: 'Turno',
                cell: (row) => (
                  <span className="inline-flex items-center rounded-md border border-line-soft bg-paper px-2.5 py-1 text-xs font-medium text-ink">
                    {row.turno}
                  </span>
                ),
              },
              {
                header: 'Matriz Curricular',
                cell: (row) => {
                  const itemsCount = row.matriz_curricular?.length ?? 0
                  const totalWeeklyHours =
                    row.matriz_curricular?.reduce(
                      (acc, item) => acc + (Number(item.aulas_semanais) || 0),
                      0,
                    ) ?? 0

                  if (itemsCount === 0) {
                    return (
                      <span className="text-xs text-muted font-normal italic">
                        Sem matérias na matriz
                      </span>
                    )
                  }

                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded border border-primary-soft-line bg-primary-soft/40 px-2 py-0.5 text-xs font-medium text-primary">
                        {itemsCount} {itemsCount === 1 ? 'matéria' : 'matérias'}
                      </span>
                      <span className="rounded border border-line-soft bg-paper px-2 py-0.5 text-xs font-mono font-semibold text-ink">
                        {totalWeeklyHours}h/sem
                      </span>
                    </div>
                  )
                },
              },
              {
                header: 'Ações',
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setMatrixTurma(row)}
                      title="Editar a matriz curricular da turma"
                    >
                      Matriz Curricular
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingTurma(row)
                        setIsTurmaDialogOpen(true)
                      }}
                    >
                      Editar
                    </Button>
                    {row.id && (
                      <button
                        type="button"
                        onClick={() => setDeletingTurma(row)}
                        className="p-1.5 text-xs text-muted hover:text-danger transition-colors"
                        title="Excluir turma"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}

        {!isLoading && (turmasQuery.data?.length ?? 0) === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-line bg-white p-8 text-center">
            <p className="text-sm font-medium text-ink">Nenhuma turma cadastrada</p>
            <p className="mt-1 text-xs text-muted">Clique em "+ Nova turma" para cadastrar a primeira turma.</p>
          </div>
        )}
      </section>

      {/* Seção de Salas */}
      <section>
        <SectionHeader
          title={`Salas (${salasQuery.data?.length ?? 0})`}
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditingSala(null)
                setIsSalaDialogOpen(true)
              }}
            >
              + Nova sala
            </Button>
          }
        />

        {salasQuery.isLoading && (
          <div className="my-6 text-center text-sm text-muted">
            Carregando salas...
          </div>
        )}

        {!salasQuery.isLoading && (
          <DataTable
            caption="Salas"
            rows={salasQuery.data ?? []}
            rowKey={(row) => String(row.id ?? row.nome)}
            columns={[
              {
                header: 'Sala',
                cell: (row) => <span className="font-semibold text-ink">{row.nome}</span>,
              },
              { header: 'Capacidade', cell: (row) => `${row.capacidade} alunos` },
              { header: 'Tipo', cell: (row) => row.tipo, className: 'text-muted' },
              {
                header: 'Indisponível',
                cell: (row) => {
                  const total = row.indisponibilidades?.length ?? 0
                  return total ? `${total} horário${total > 1 ? 's' : ''}` : 'Livre'
                },
                className: 'text-muted',
              },
              {
                header: 'Ações',
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingSala(row)
                        setIsSalaDialogOpen(true)
                      }}
                    >
                      Editar
                    </Button>
                    {row.id && (
                      <Button variant="secondary" size="sm" onClick={() => setHorariosSalaId(row.id!)}>
                        Horários
                      </Button>
                    )}
                    {row.id && (
                      <button
                        type="button"
                        onClick={() => setDeletingSala(row)}
                        className="p-1.5 text-xs text-muted hover:text-danger transition-colors"
                        title="Excluir sala"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}

        {!salasQuery.isLoading && (salasQuery.data?.length ?? 0) === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-line bg-white p-8 text-center">
            <p className="text-sm font-medium text-ink">Nenhuma sala cadastrada</p>
            <p className="mt-1 text-xs text-muted">Clique em "+ Nova sala" para cadastrar a primeira sala.</p>
          </div>
        )}
      </section>

      {/* Modal de Matriz Curricular */}
      {matrixTurma && (
        <CurriculumMatrixDialog
          turma={matrixTurma}
          availableSubjects={availableSubjects}
          teachers={teachersWithSubjects}
          onClose={() => setMatrixTurma(null)}
          onSave={handleSaveMatrix}
        />
      )}

      {/* Modal de Criar / Editar Turma */}
      {isTurmaDialogOpen && (
        <TurmaDialog
          turma={editingTurma}
          onClose={() => {
            setIsTurmaDialogOpen(false)
            setEditingTurma(null)
          }}
          onSave={handleSaveTurma}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingTurma && (
        <DeleteTurmaDialog
          turma={deletingTurma}
          onClose={() => setDeletingTurma(null)}
          onConfirm={() => handleDeleteTurma(deletingTurma.id!)}
        />
      )}

      {/* Modal de Criar / Editar Sala */}
      {isSalaDialogOpen && (
        <SalaDialog
          sala={editingSala}
          salas={salasQuery.data ?? []}
          onClose={() => {
            setIsSalaDialogOpen(false)
            setEditingSala(null)
          }}
          onSave={handleSaveSala}
        />
      )}

      {/* Modal de Horários Indisponíveis da Sala */}
      {horariosSala && (
        <SalaIndisponibilidadeDialog
          sala={horariosSala}
          onClose={() => setHorariosSalaId(null)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ['salas'] })}
        />
      )}

      {/* Modal de Confirmação de Exclusão de Sala */}
      {deletingSala && (
        <DeleteSalaDialog
          sala={deletingSala}
          onClose={() => setDeletingSala(null)}
          onConfirm={() => handleDeleteSala(deletingSala.id!)}
        />
      )}
    </>
  )
}
