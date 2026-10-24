import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/Button'
import type { TurmaBackend } from '@/api/turmas'
import { niveisEnsino, TURNO_MANHA_E_TARDES, weekDays } from '@/lib/schedule'

interface TurmaDialogProps {
  turma?: TurmaBackend | null
  onClose: () => void
  onSave: (turma: Omit<TurmaBackend, 'id'> & { id?: number }) => Promise<void>
}

// Turnos com horários definidos no core-service (services/time_slots.py)
const SHIFT_OPTIONS = ['Manhã', 'Tarde', 'Integral', TURNO_MANHA_E_TARDES] as const

export function TurmaDialog({ turma, onClose, onSave }: TurmaDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [nome, setNome] = useState(turma?.nome ?? '')
  const [turno, setTurno] = useState<string>(turma?.turno ?? 'Manhã')
  const [nivel, setNivel] = useState<string>(turma?.nivel_ensino ?? 'Anos Finais')
  // Turno "Manhã + tardes": dias com aula à tarde; nenhum marcado = o gerador escolhe
  const [tardes, setTardes] = useState<string[]>(turma?.tardes ?? [])
  const toggleTarde = (dia: string) =>
    setTardes((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]))
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
  }, [])

  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedNome = nome.trim()
    if (!trimmedNome) {
      setError('Informe o nome da turma.')
      return
    }

    try {
      setIsSubmitting(true)
      await onSave({
        id: turma?.id,
        nome: trimmedNome,
        turno,
        nivel_ensino: nivel,
        tardes: turno === TURNO_MANHA_E_TARDES ? tardes : [],
      })
      close()
    } catch (err) {
      console.error(err)
      setError('Erro ao salvar turma. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      aria-labelledby="turma-dialog-title"
      className="m-auto w-[min(460px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h3 id="turma-dialog-title" className="text-[17px] font-semibold">
          {turma ? 'Editar Turma' : 'Nova Turma'}
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          {turma
            ? 'Altere as informações da turma selecionada.'
            : 'Cadastre uma nova turma com seu respectivo turno.'}
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <FormField
            label="Nome da turma"
            placeholder="Ex.: 6º Ano A, 7º Ano B, 1º EM A..."
            value={nome}
            onChange={(e) => {
              setNome(e.target.value)
              if (error) setError('')
            }}
            error={error}
            autoFocus
          />

          <SelectField
            label="Turno"
            options={SHIFT_OPTIONS}
            value={turno}
            onChange={(e) => setTurno(e.target.value)}
          />

          {turno === TURNO_MANHA_E_TARDES && (
            <fieldset className="rounded-md border border-line-soft bg-paper p-3">
              <legend className="px-1 text-xs font-medium text-muted">Tardes com aula</legend>
              <div className="flex flex-wrap gap-3">
                {weekDays.map((dia) => (
                  <label key={dia} className="flex items-center gap-1.5 text-xs text-ink">
                    <input type="checkbox" checked={tardes.includes(dia)} onChange={() => toggleTarde(dia)} />
                    {dia}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Todas as manhãs têm aula. Sem nenhum dia marcado, o gerador escolhe as tardes, usando o mínimo possível.
              </p>
            </fieldset>
          )}

          <SelectField
            label="Nível de ensino (define os horários das aulas)"
            options={niveisEnsino}
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : turma ? 'Salvar alterações' : 'Cadastrar turma'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
