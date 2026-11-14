import { useState, type FormEvent } from 'react'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/Button'
import { Sheet, SheetBody, SheetFooter } from '@/components/ui/Sheet'
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
  const [dia, setDia] = useState<string>(weekDays[0])
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

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

  // Agrupados por dia para ler a semana de cima para baixo
  const porDia = weekDays
    .map((d) => ({ dia: d, itens: indisponibilidades.filter((i) => i.dia_semana === d) }))
    .filter((g) => g.itens.length > 0)

  return (
    <Sheet
      width="md"
      onClose={onClose}
      title={sala.nome}
      description="Horários bloqueados: períodos em que a sala está ocupada por outras atividades. O gerador não coloca aulas que usam esta sala nesses horários."
    >
      <SheetBody className="space-y-6">
        <form onSubmit={handleAdd} noValidate className="rounded-2xl bg-paper p-4">
          <h3 className="mb-3 font-display text-[16px] font-bold">Bloquear um horário</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <SelectField label="Dia" options={OPCOES_DIA} value={dia} onChange={(e) => setDia(e.target.value)} />
            </div>
            <FormField label="Início" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <FormField label="Fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <FormField
                label="Motivo (opcional)"
                placeholder="Ex.: treino do time, evento, manutenção"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <Button type="submit" variant="dark" className="h-11" disabled={isSubmitting}>
              {isSubmitting ? 'Bloqueando…' : 'Bloquear'}
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-danger">
              {error}
            </p>
          )}
        </form>

        <section>
          <h3 className="mb-3 font-display text-[16px] font-bold">
            Bloqueados{indisponibilidades.length > 0 && ` (${indisponibilidades.length})`}
          </h3>
          {porDia.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line p-6 text-center text-[14px] text-muted">
              Nenhum horário bloqueado. A sala pode receber aulas a semana toda.
            </p>
          ) : (
            <div className="space-y-4">
              {porDia.map(({ dia: d, itens }) => (
                <div key={d}>
                  <p className="mb-1.5 text-[13px] font-semibold text-muted">{d}</p>
                  <ul className="divide-y divide-line-soft rounded-2xl border border-line-soft">
                    {itens.map((ind) => (
                      <li key={ind.id} className="flex items-center gap-3 py-2 pr-2 pl-4 text-[14px]">
                        <span className="font-semibold tabular-nums">
                          {ind.horario_inicio} – {ind.horario_fim}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{ind.motivo}</span>
                        <button
                          type="button"
                          onClick={() => handleRemove(ind)}
                          disabled={removingId === ind.id}
                          className="rounded-full px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                        >
                          {removingId === ind.id ? 'Liberando…' : 'Liberar'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </SheetBody>
      <SheetFooter start="Cada bloqueio é salvo na hora.">
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </SheetFooter>
    </Sheet>
  )
}
