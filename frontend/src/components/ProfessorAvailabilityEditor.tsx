import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDisponibilidadeProfessor, saveDisponibilidadeProfessor, type ProfessorBackend } from '@/api/professores'
import { Button } from '@/components/ui/Button'
import { SheetBody, SheetFooter, useSheetClose } from '@/components/ui/Sheet'
import { getApiErrorMessage } from '@/lib/apiError'
import { itemsToSlots, slotsToItems, type AvailabilitySlots } from '@/lib/availability'
import { niveisEnsino, type NivelEnsino } from '@/lib/schedule'
import { useHorarios } from '@/schedule/useHorarios'
import { AvailabilityGrid } from './AvailabilityGrid'

interface ProfessorAvailabilityEditorProps {
  professor: ProfessorBackend
  onSaved?: () => void
  /** Avisa o painel quando há alterações não salvas */
  onDirty?: () => void
}

/** Carrega, edita e salva a disponibilidade de um professor. Feito para o corpo de um Sheet. */
export function ProfessorAvailabilityEditor({ professor, onSaved, onDirty }: ProfessorAvailabilityEditorProps) {
  const horariosQuery = useHorarios()
  const disponibilidadeQuery = useQuery({
    queryKey: ['disponibilidade', professor.id],
    queryFn: () => getDisponibilidadeProfessor(professor.id!),
  })

  if (horariosQuery.isLoading || disponibilidadeQuery.isLoading || !horariosQuery.data || !disponibilidadeQuery.data) {
    const failed = !horariosQuery.isLoading && !disponibilidadeQuery.isLoading
    return (
      <SheetBody>
        <p className={failed ? 'py-8 text-center text-sm text-danger' : 'py-8 text-center text-sm text-muted'}>
          {failed ? 'Não foi possível carregar a disponibilidade.' : 'Carregando disponibilidade…'}
        </p>
      </SheetBody>
    )
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
      onDirty={onDirty}
    />
  )
}

function EditorForm({
  professor,
  niveis,
  initial,
  horarios,
  onSaved,
  onDirty,
}: Omit<ProfessorAvailabilityEditorProps, 'professor'> & {
  professor: ProfessorBackend
  niveis: NivelEnsino[]
  initial: AvailabilitySlots
  horarios: NonNullable<ReturnType<typeof useHorarios>['data']>
}) {
  const queryClient = useQueryClient()
  const close = useSheetClose()
  const [slots, setSlots] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)
      await saveDisponibilidadeProfessor(professor.id!, slotsToItems(slots))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['disponibilidade', professor.id] }),
        queryClient.invalidateQueries({ queryKey: ['professores'] }),
      ])
      onSaved?.()
    } catch (err) {
      console.error(err)
      setError(getApiErrorMessage(err, 'Não foi possível salvar a disponibilidade. Tente novamente.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <SheetBody>
        <AvailabilityGrid
          niveis={niveis}
          horarios={horarios}
          slots={slots}
          onChange={(update) => {
            setSlots(update)
            setError(null)
            onDirty?.()
          }}
        />
      </SheetBody>
      <SheetFooter
        start={
          error ? (
            <span role="alert" className="font-medium text-danger">
              {error}
            </span>
          ) : (
            'Até salvar, nada muda para o gerador.'
          )
        }
      >
        <Button variant="secondary" onClick={close} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando…' : 'Salvar disponibilidade'}
        </Button>
      </SheetFooter>
    </>
  )
}
