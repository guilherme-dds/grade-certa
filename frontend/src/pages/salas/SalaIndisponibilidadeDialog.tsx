import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/Button'
import {
  addIndisponibilidadeSala,
  removeIndisponibilidadeSala,
  type IndisponibilidadeSala,
  type SalaBackend,
} from '@/api/salas'
import { weekDays } from '@/lib/schedule'
import { getApiErrorMessage } from '@/lib/apiError'

const TODOS_OS_DIAS = 'Todos os dias'
const OPCOES_DIA = [TODOS_OS_DIAS, ...weekDays] as const

interface SalaIndisponibilidadeDialogProps {
  sala: SalaBackend
  onClose: () => void
  /** Chamado após adicionar/remover, para recarregar a lista de salas */
  onChanged: () => Promise<unknown>
}

export function SalaIndisponibilidadeDialog({ sala, onClose, onChanged }: SalaIndisponibilidadeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [dia, setDia] = useState<string>(weekDays[0])
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

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

  const indisponibilidades = [...(sala.indisponibilidades ?? [])].sort(
    (a, b) =>
      weekDays.indexOf(a.dia_semana as (typeof weekDays)[number]) -
        weekDays.indexOf(b.dia_semana as (typeof weekDays)[number]) ||
      a.horario_inicio.localeCompare(b.horario_inicio),
  )

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!inicio || !fim) {
      setError('Informe o horário de início e de fim.')
      return
    }
    if (fim <= inicio) {
      setError('O horário de fim precisa ser depois do início.')
      return
    }

    const dias = dia === TODOS_OS_DIAS ? [...weekDays] : [dia]
    try {
      setIsSubmitting(true)
      setError(null)
      for (const d of dias) {
        await addIndisponibilidadeSala(sala.id!, {
          dia_semana: d,
          horario_inicio: inicio,
          horario_fim: fim,
          motivo: motivo.trim() || null,
        })
      }
      await onChanged()
      setInicio('')
      setFim('')
      setMotivo('')
    } catch (err) {
      console.error(err)
      setError(getApiErrorMessage(err, 'Erro ao salvar horário. Tente novamente.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async (ind: IndisponibilidadeSala) => {
    try {
      setRemovingId(ind.id!)
      setError(null)
      await removeIndisponibilidadeSala(sala.id!, ind.id!)
      await onChanged()
    } catch (err) {
      console.error(err)
      setError(getApiErrorMessage(err, 'Erro ao remover horário. Tente novamente.'))
    } finally {
      setRemovingId(null)
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
      aria-labelledby="sala-indisp-dialog-title"
      className="m-auto w-[min(560px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <div className="p-6">
        <h3 id="sala-indisp-dialog-title" className="text-[17px] font-semibold">
          Horários indisponíveis — {sala.nome}
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          Períodos em que a sala está ocupada por outras atividades. O gerador não coloca aulas que
          usam esta sala nesses horários.
        </p>

        <form onSubmit={handleAdd} noValidate className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField label="Dia" options={OPCOES_DIA} value={dia} onChange={(e) => setDia(e.target.value)} />
          <FormField label="Início" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <FormField label="Fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Adicionar'}
            </Button>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <FormField
              label="Motivo (opcional)"
              placeholder="Ex.: Treino do time, evento, manutenção..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </form>

        {error && <p className="mt-3 text-xs text-danger">{error}</p>}

        <div className="mt-5">
          {indisponibilidades.length === 0 ? (
            <p className="rounded-md border border-dashed border-line p-4 text-center text-xs text-muted">
              Nenhum horário indisponível. A sala pode receber aulas a semana toda.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft rounded-md border border-line">
              {indisponibilidades.map((ind) => (
                <li key={ind.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-10 font-semibold">{ind.dia_semana}</span>
                  <span className="font-mono text-[13px]">
                    {ind.horario_inicio} – {ind.horario_fim}
                  </span>
                  <span className="flex-1 truncate text-xs text-muted">{ind.motivo}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(ind)}
                    disabled={removingId === ind.id}
                    className="p-1.5 text-xs text-muted transition-colors hover:text-danger disabled:opacity-50"
                    title="Remover horário"
                  >
                    {removingId === ind.id ? 'Removendo...' : 'Remover'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="secondary" onClick={close}>
            Fechar
          </Button>
        </div>
      </div>
    </dialog>
  )
}
