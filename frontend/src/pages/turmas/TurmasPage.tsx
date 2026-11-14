import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDisciplinas } from '@/api/disciplinas'
import { getProfessores } from '@/api/professores'
import { createTurma, deleteTurma, getTurmas, updateTurma, type ItemMatriz, type TurmaBackend } from '@/api/turmas'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { RowMenu } from '@/components/ui/RowMenu'
import { TabHeader } from '@/layouts/SectionLayout'
import { temTardesParciais } from '@/lib/schedule'
import { CurriculumMatrixDialog, type TeacherWithSubjects } from './CurriculumMatrixDialog'
import { DeleteTurmaDialog } from './DeleteTurmaDialog'
import { TurmaDialog } from './TurmaDialog'

export function TurmasPage() {
  const queryClient = useQueryClient()

  const [isTurmaDialogOpen, setIsTurmaDialogOpen] = useState(false)
  const [editingTurma, setEditingTurma] = useState<TurmaBackend | null>(null)
  const [deletingTurma, setDeletingTurma] = useState<TurmaBackend | null>(null)
  // Matriz aberta fica na URL (?matriz=<id>) para outras telas abrirem direto nela
  const [params, setParams] = useSearchParams()

  const turmasQuery = useQuery({ queryKey: ['turmas'], queryFn: getTurmas })
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })
  const disciplinasQuery = useQuery({ queryKey: ['disciplinas'], queryFn: () => getDisciplinas() })

  const availableSubjects = useMemo(() => (disciplinasQuery.data ?? []).map((d) => d.nome), [disciplinasQuery.data])

  // Mapeia cada docente para suas disciplinas cadastradas
  const teachersWithSubjects = useMemo<TeacherWithSubjects[]>(() => {
    const discMap = new Map<number, string>()
    ;(disciplinasQuery.data ?? []).forEach((d) => {
      if (d.id) discMap.set(d.id, d.nome)
    })

    // Inativos também vão: a matriz pode mantê-los, mas só os ativos aparecem para escolha
    return (professoresQuery.data ?? []).flatMap((p) =>
      p.id
        ? [
            {
              id: p.id,
              name: p.nome,
              active: p.ativo,
              subjects: (p.disciplinas ?? []).map((id) => discMap.get(id)).filter((n): n is string => Boolean(n)),
            },
          ]
        : [],
    )
  }, [professoresQuery.data, disciplinasQuery.data])

  const matrixTurma = turmasQuery.data?.find((t) => String(t.id) === params.get('matriz')) ?? null
  const setMatrixTurma = (turma: TurmaBackend | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (turma?.id) next.set('matriz', String(turma.id))
        else next.delete('matriz')
        return next
      },
      { replace: true },
    )

  const toast = useToast()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['turmas'] })
  const createTurmaMutation = useMutation({ mutationFn: createTurma, onSuccess: invalidate })
  const updateTurmaMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TurmaBackend }) => updateTurma(id, payload),
    onSuccess: invalidate,
  })
  const deleteTurmaMutation = useMutation({ mutationFn: deleteTurma, onSuccess: invalidate })

  const handleSaveTurma = async (data: Omit<TurmaBackend, 'id'> & { id?: number }) => {
    if (data.id) {
      const existing = turmasQuery.data?.find((t) => t.id === data.id)
      await updateTurmaMutation.mutateAsync({
        id: data.id,
        payload: {
          ...existing,
          id: data.id,
          nome: data.nome,
          turno: data.turno,
          nivel_ensino: data.nivel_ensino,
          tardes: data.tardes ?? [],
          matriz_curricular: existing?.matriz_curricular ?? [],
        },
      })
      toast(`${data.nome} salva`)
    } else {
      const criada = await createTurmaMutation.mutateAsync({
        nome: data.nome,
        turno: data.turno,
        nivel_ensino: data.nivel_ensino,
        tardes: data.tardes ?? [],
        matriz_curricular: [],
      })
      toast(`${criada.nome} cadastrada. Agora monte a matriz.`)
      // O próximo passo de uma turma nova é a matriz: abre direto
      setMatrixTurma(criada)
    }
  }

  const handleSaveMatrix = async (matriz: ItemMatriz[]) => {
    if (!matrixTurma || !matrixTurma.id) return
    await updateTurmaMutation.mutateAsync({
      id: matrixTurma.id,
      payload: { ...matrixTurma, matriz_curricular: matriz },
    })
    setMatrixTurma(null)
    toast(`Matriz de ${matrixTurma.nome} salva`)
  }

  const handleDeleteTurma = async (id: number) => {
    const nome = deletingTurma?.nome
    await deleteTurmaMutation.mutateAsync(id)
    setDeletingTurma(null)
    if (nome) toast(`${nome} excluída`)
  }

  const turmas = turmasQuery.data ?? []
  const openNew = () => {
    setEditingTurma(null)
    setIsTurmaDialogOpen(true)
  }

  return (
    <>
      <TabHeader
        title="Turmas"
        description="Cada turma precisa de uma matriz curricular: as disciplinas, quantas aulas por semana e quem dá cada uma."
        actions={<Button onClick={openNew}>Nova turma</Button>}
      />

      {turmasQuery.isLoading ? (
        <p className="my-6 text-center text-sm text-muted">Carregando turmas…</p>
      ) : turmas.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-line bg-white/60 p-10 text-center">
          <p className="font-semibold">Nenhuma turma cadastrada</p>
          <p className="mt-1 text-[14px] text-muted">Cadastre as turmas e depois monte a matriz de cada uma.</p>
          <Button onClick={openNew} className="mt-4">
            Cadastrar primeira turma
          </Button>
        </div>
      ) : (
        <DataTable
          caption="Turmas"
          rows={turmas}
          rowKey={(row) => String(row.id ?? row.nome)}
          columns={[
            { header: 'Turma', cell: (row) => <span className="font-semibold text-ink">{row.nome}</span> },
            {
              header: 'Turno',
              cell: (row) => (
                <span className="inline-flex rounded-full bg-paper px-2.5 py-1 text-[12.5px] font-medium">
                  {row.turno}
                </span>
              ),
            },
            {
              header: 'Tardes',
              cell: (row) =>
                temTardesParciais(row.turno) ? (row.tardes?.length ? row.tardes.join(', ') : 'Automáticas') : '—',
              className: 'text-muted',
            },
            { header: 'Nível', cell: (row) => row.nivel_ensino ?? '—', className: 'text-muted' },
            {
              header: 'Matriz curricular',
              cell: (row) => {
                const itemsCount = row.matriz_curricular?.length ?? 0
                const totalWeekly =
                  row.matriz_curricular?.reduce((acc, item) => acc + (Number(item.aulas_semanais) || 0), 0) ?? 0

                if (itemsCount === 0 || totalWeekly === 0) {
                  return (
                    <span className="inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-[12.5px] font-semibold text-warning">
                      Falta montar
                    </span>
                  )
                }
                return (
                  <span className="text-[13.5px]">
                    <span className="font-semibold">{itemsCount}</span>{' '}
                    <span className="text-muted">{itemsCount === 1 ? 'disciplina' : 'disciplinas'} ·</span>{' '}
                    <span className="font-semibold tabular-nums">{totalWeekly}</span>{' '}
                    <span className="text-muted">{totalWeekly === 1 ? 'aula' : 'aulas'}/semana</span>
                  </span>
                )
              },
            },
            {
              header: 'Ações',
              className: 'text-right',
              cell: (row) => {
                const vazia = !(row.matriz_curricular ?? []).some((i) => Number(i.aulas_semanais) > 0)
                return (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant={vazia ? 'primary' : 'secondary'} size="sm" onClick={() => setMatrixTurma(row)}>
                      {vazia ? 'Montar matriz' : 'Matriz'}
                    </Button>
                    <RowMenu
                      label={`Mais ações para ${row.nome}`}
                      items={[
                        {
                          label: 'Editar turma',
                          onSelect: () => {
                            setEditingTurma(row)
                            setIsTurmaDialogOpen(true)
                          },
                        },
                        ...(row.id ? [{ label: 'Excluir', danger: true, onSelect: () => setDeletingTurma(row) }] : []),
                      ]}
                    />
                  </div>
                )
              },
            },
          ]}
        />
      )}

      {matrixTurma && (
        <CurriculumMatrixDialog
          turma={matrixTurma}
          availableSubjects={availableSubjects}
          teachers={teachersWithSubjects}
          otherTurmas={turmas}
          onClose={() => setMatrixTurma(null)}
          onSave={handleSaveMatrix}
        />
      )}

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

      {deletingTurma && (
        <DeleteTurmaDialog
          turma={deletingTurma}
          onClose={() => setDeletingTurma(null)}
          onConfirm={() => handleDeleteTurma(deletingTurma.id!)}
        />
      )}
    </>
  )
}
