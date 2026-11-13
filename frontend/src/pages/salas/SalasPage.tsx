import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSala, deleteSala, getSalas, updateSala, type SalaBackend } from '@/api/salas'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { TabHeader } from '@/layouts/SectionLayout'
import { DeleteSalaDialog } from './DeleteSalaDialog'
import { SalaDialog } from './SalaDialog'
import { SalaIndisponibilidadeDialog } from './SalaIndisponibilidadeDialog'

export function SalasPage() {
  const queryClient = useQueryClient()
  const [isSalaDialogOpen, setIsSalaDialogOpen] = useState(false)
  const [editingSala, setEditingSala] = useState<SalaBackend | null>(null)
  const [deletingSala, setDeletingSala] = useState<SalaBackend | null>(null)
  const [horariosSalaId, setHorariosSalaId] = useState<number | null>(null)

  const salasQuery = useQuery({ queryKey: ['salas'], queryFn: getSalas })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['salas'] })

  const createSalaMutation = useMutation({ mutationFn: createSala, onSuccess: invalidate })
  const updateSalaMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SalaBackend }) => updateSala(id, payload),
    onSuccess: invalidate,
  })
  const deleteSalaMutation = useMutation({ mutationFn: deleteSala, onSuccess: invalidate })

  const handleSaveSala = async ({ id, ...data }: Omit<SalaBackend, 'id'> & { id?: number }) => {
    if (id) await updateSalaMutation.mutateAsync({ id, payload: { id, ...data } })
    else await createSalaMutation.mutateAsync(data)
  }

  const handleDeleteSala = async (id: number) => {
    await deleteSalaMutation.mutateAsync(id)
    setDeletingSala(null)
  }

  // Lido da query para refletir os horários adicionados/removidos sem fechar o modal
  const horariosSala = salasQuery.data?.find((s) => s.id === horariosSalaId) ?? null
  const salas = salasQuery.data ?? []
  const openNew = () => {
    setEditingSala(null)
    setIsSalaDialogOpen(true)
  }

  return (
    <>
      <TabHeader
        title="Salas"
        description="Salas e laboratórios disponíveis. Marque os horários em que uma sala não pode ser usada."
        actions={<Button onClick={openNew}>Nova sala</Button>}
      />

      {salasQuery.isLoading ? (
        <p className="my-6 text-center text-sm text-muted">Carregando salas…</p>
      ) : salas.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-line bg-white/60 p-10 text-center">
          <p className="font-semibold">Nenhuma sala cadastrada</p>
          <p className="mt-1 text-[14px] text-muted">Sem salas, a grade é gerada sem alocar sala às aulas.</p>
          <Button onClick={openNew} className="mt-4">
            Cadastrar primeira sala
          </Button>
        </div>
      ) : (
        <DataTable
          caption="Salas"
          rows={salas}
          rowKey={(row) => String(row.id ?? row.nome)}
          columns={[
            { header: 'Sala', cell: (row) => <span className="font-semibold text-ink">{row.nome}</span> },
            { header: 'Capacidade', cell: (row) => `${row.capacidade} alunos`, className: 'tabular-nums' },
            { header: 'Tipo', cell: (row) => row.tipo, className: 'text-muted' },
            {
              header: 'Disponibilidade',
              cell: (row) => {
                const total = row.indisponibilidades?.length ?? 0
                return total ? (
                  <span className="inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-[12.5px] font-semibold text-warning">
                    {total} horário{total > 1 ? 's' : ''} bloqueado{total > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-1 text-[12.5px] font-semibold text-primary">
                    Livre a semana toda
                  </span>
                )
              },
            },
            {
              header: 'Ações',
              className: 'text-right',
              cell: (row) => (
                <div className="flex items-center justify-end gap-2">
                  {row.id && (
                    <Button variant="secondary" size="sm" onClick={() => setHorariosSalaId(row.id!)}>
                      Horários
                    </Button>
                  )}
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
                    <button
                      type="button"
                      onClick={() => setDeletingSala(row)}
                      className="rounded-full px-2 py-1.5 text-[13px] text-muted transition-colors hover:text-danger"
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

      {isSalaDialogOpen && (
        <SalaDialog
          sala={editingSala}
          salas={salas}
          onClose={() => {
            setIsSalaDialogOpen(false)
            setEditingSala(null)
          }}
          onSave={handleSaveSala}
        />
      )}

      {horariosSala && (
        <SalaIndisponibilidadeDialog sala={horariosSala} onClose={() => setHorariosSalaId(null)} onChanged={invalidate} />
      )}

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
