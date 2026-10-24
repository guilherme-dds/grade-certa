import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getDisponibilidadeProfessor,
  saveDisponibilidadeProfessor,
  type ProfessorBackend,
} from '@/api/professores'
import { Button } from '@/components/ui/Button'
import { getApiErrorMessage } from '@/lib/apiError'
import { niveisEnsino, type NivelEnsino } from '@/lib/schedule'
import { useHorarios } from '@/schedule/useHorarios'
import { itemsToSlots, slotsToItems, type AvailabilitySlots } from '@/lib/availability'
import { AvailabilityGrid } from './AvailabilityGrid'

interface ProfessorAvailabilityEditorProps {
  professor: ProfessorBackend
  onSaved?: () => void
  /** Botões extras ao lado de "Salvar" (ex.: Cancelar do modal) */
  actions?: ReactNode
}

/** Carrega, edita e salva no core-service a disponibilidade de um professor. */
export function ProfessorAvailabilityEditor({ professor, onSaved, actions }: ProfessorAvailabilityEditorProps) {
  const horariosQuery = useHorarios()
  const disponibilidadeQuery = useQuery({
    queryKey: ['disponibilidade', professor.id],
    queryFn: () => getDisponibilidadeProfessor(professor.id!),
  })

  if (horariosQuery.isLoading || disponibilidadeQuery.isLoading) {
    return <p className="py-8 text-center text-sm text-muted">Carregando disponibilidade...</p>
  }
  if (!horariosQuery.data || !disponibilidadeQuery.data) {
    return <p className="py-8 text-center text-sm text-danger">Não foi possível carregar a disponibilidade.</p>
  }

  const niveis = (professor.niveis_ensino?.length ? professor.niveis_ensino : ['Anos Finais']).filter(
    (n): n is NivelEnsino => (niveisEnsino as readonly string[]).includes(n),
  )

  return (
    <EditorForm
      key={professor.id}
      professor={professor}
      niveis={niveis}
      initial={itemsToSlots(disponibilidadeQuery.data, niveis, horariosQuery.data)}
      horarios={horariosQuery.data}
      onSaved={onSaved}
      actions={actions}
    />
  )
}

function EditorForm({
  professor,
  niveis,
  initial,
  horarios,
  onSaved,
  actions,
}: Omit<ProfessorAvailabilityEditorProps, 'professor'> & {
  professor: ProfessorBackend
  niveis: NivelEnsino[]
  initial: AvailabilitySlots
  horarios: NonNullable<ReturnType<typeof useHorarios>['data']>
}) {
  const queryClient = useQueryClient()
  const [slots, setSlots] = useState(initial)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setStatus(null)
      await saveDisponibilidadeProfessor(professor.id!, slotsToItems(slots))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['disponibilidade', professor.id] }),
        queryClient.invalidateQueries({ queryKey: ['professores'] }),
      ])
      setStatus({ ok: true, text: '✓ Disponibilidade salva.' })
      onSaved?.()
    } catch (err) {
      console.error(err)
      setStatus({ ok: false, text: getApiErrorMessage(err, 'Erro ao salvar disponibilidade. Tente novamente.') })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <AvailabilityGrid
        niveis={niveis}
        horarios={horarios}
        slots={slots}
        onChange={(next) => {
          setSlots(next)
          setStatus(null)
        }}
      />

      {status && (
        <p className={status.ok ? 'mt-3 text-xs font-semibold text-primary' : 'mt-3 text-xs text-danger'}>
          {status.text}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        {actions}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar disponibilidade'}
        </Button>
      </div>
    </>
  )
}
