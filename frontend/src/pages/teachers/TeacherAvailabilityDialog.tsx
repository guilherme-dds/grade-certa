import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import {
  timeSlotsByNivel,
  weekDays,
  type NivelEnsinoSchedule,
} from '@/mocks/data'
import { type NivelEnsino, type Teacher } from '@/mocks/teachers'

export type SlotState = 'indisponivel' | 'disponivel' | 'preferencial'

const slotStyles: Record<SlotState, { label: string; className: string }> = {
  disponivel: { label: 'Disponível', className: 'bg-primary text-white font-medium' },
  preferencial: {
    label: 'Preferencial',
    className: 'border-2 border-warning bg-warning-soft text-warning font-semibold',
  },
  indisponivel: { label: 'Indisponível', className: 'bg-line-soft hover:bg-line text-muted' },
}

const nextState: Record<SlotState, SlotState> = {
  indisponivel: 'disponivel',
  disponivel: 'preferencial',
  preferencial: 'indisponivel',
}

const slotKey = (nivel: string, day: string, time: string) => `${nivel}__${day}__${time}`

interface TeacherAvailabilityDialogProps {
  teacher: Teacher
  initialSlots?: Record<string, SlotState>
  onClose: () => void
  onSave?: (slots: Record<string, SlotState>) => void
}

export function TeacherAvailabilityDialog({
  teacher,
  initialSlots,
  onClose,
  onSave,
}: TeacherAvailabilityDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Níveis de Ensino em que este professor leciona (pelo menos 1)
  const teacherNiveis: NivelEnsino[] =
    teacher.niveisEnsino && teacher.niveisEnsino.length > 0
      ? teacher.niveisEnsino
      : ['Anos Finais']

  const [activeNivel, setActiveNivel] = useState<NivelEnsinoSchedule>(
    teacherNiveis[0] as NivelEnsinoSchedule,
  )

  const [slots, setSlots] = useState<Record<string, SlotState>>(() =>
    initialSlots ?? buildDefaultSlots(teacherNiveis as NivelEnsinoSchedule[]),
  )
  const [savedSuccess, setSavedSuccess] = useState(false)

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

  const toggle = (key: string) => {
    setSlots((prev) => ({
      ...prev,
      [key]: nextState[prev[key] ?? 'indisponivel'],
    }))
    setSavedSuccess(false)
  }

  const currentSchedule = timeSlotsByNivel[activeNivel] ?? timeSlotsByNivel['Anos Finais']

  const handleSetShift = (shift: 'manha' | 'tarde') => {
    const times = currentSchedule[shift]
    const updated = { ...slots }
    for (const day of weekDays) {
      for (const time of times) {
        updated[slotKey(activeNivel, day, time)] = 'disponivel'
      }
    }
    setSlots(updated)
    setSavedSuccess(false)
  }

  const handleClearCurrentNivel = () => {
    const allTimes = [...currentSchedule.manha, ...currentSchedule.tarde]
    const updated = { ...slots }
    for (const day of weekDays) {
      for (const time of allTimes) {
        updated[slotKey(activeNivel, day, time)] = 'indisponivel'
      }
    }
    setSlots(updated)
    setSavedSuccess(false)
  }

  const handleSave = () => {
    onSave?.(slots)
    setSavedSuccess(true)
    setTimeout(() => {
      close()
    }, 400)
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
      aria-labelledby="availability-dialog-title"
      className="m-auto w-[min(740px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <div className="p-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="availability-dialog-title" className="text-[17px] font-semibold">
              Horários de Disponibilidade — {teacher.name}
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Alterne os horários disponíveis e preferenciais conforme a grade de cada nível de ensino.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-muted hover:bg-paper hover:text-ink text-sm font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Abas para selecionar Nível de Ensino */}
        <div className="mt-4 flex flex-wrap gap-1.5 border-b border-line pb-2">
          {teacherNiveis.map((nivel) => {
            const isActive = activeNivel === nivel
            return (
              <button
                key={nivel}
                type="button"
                onClick={() => {
                  setActiveNivel(nivel as NivelEnsinoSchedule)
                  setSavedSuccess(false)
                }}
                className={cn(
                  'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-navy text-white shadow-xs'
                    : 'bg-paper text-muted hover:text-ink hover:bg-line-soft',
                )}
              >
                {nivel}
              </button>
            )
          })}
        </div>

        {/* Barra de Ações Rápidas do Nível Ativo */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-soft bg-paper p-2.5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSetShift('manha')}
              className="rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-paper transition-colors"
            >
              + Marcar Manhã ({activeNivel})
            </button>
            <button
              type="button"
              onClick={() => handleSetShift('tarde')}
              className="rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-paper transition-colors"
            >
              + Marcar Tarde ({activeNivel})
            </button>
            <button
              type="button"
              onClick={handleClearCurrentNivel}
              className="rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-muted hover:text-danger transition-colors"
            >
              Limpar Este Nível
            </button>
          </div>
          <span className="text-[11px] text-muted">
            Clique na célula para alternar o estado.
          </span>
        </div>

        {/* Grade de Horários da Manhã e Tarde */}
        <div className="mt-4 space-y-5 max-h-[52vh] overflow-y-auto pr-1">
          {/* Turno da Manhã */}
          <div>
            <h3 className="mb-2 text-xs font-bold text-ink uppercase tracking-wider">
              Turno da Manhã ({activeNivel})
            </h3>
            <ScheduleGridTable
              nivel={activeNivel}
              times={currentSchedule.manha}
              slots={slots}
              onToggle={toggle}
            />
          </div>

          {/* Turno da Tarde */}
          <div>
            <h3 className="mb-2 text-xs font-bold text-ink uppercase tracking-wider">
              Turno da Tarde ({activeNivel})
            </h3>
            <ScheduleGridTable
              nivel={activeNivel}
              times={currentSchedule.tarde}
              slots={slots}
              onToggle={toggle}
            />
          </div>
        </div>

        {/* Legenda de Cores */}
        <ul className="mt-4 flex flex-wrap items-center justify-between border-t border-line-soft pt-3 text-[12px] text-muted">
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded bg-primary" />
            <span>Disponível (✓)</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded border-2 border-warning bg-warning-soft" />
            <span>Preferencial (★)</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded bg-line-soft" />
            <span>Indisponível</span>
          </li>
        </ul>

        {savedSuccess && (
          <p className="mt-3 text-center text-xs font-semibold text-primary">
            ✓ Horários de disponibilidade atualizados!
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar horários</Button>
        </div>
      </div>
    </dialog>
  )
}

function ScheduleGridTable({
  nivel,
  times,
  slots,
  onToggle,
}: {
  nivel: string
  times: readonly string[]
  slots: Record<string, SlotState>
  onToggle: (key: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div
        role="grid"
        className="grid min-w-[540px] grid-cols-[100px_repeat(5,1fr)] gap-1.5"
      >
        {/* Cabeçalho dos dias */}
        <div role="row" className="contents">
          <div role="columnheader" />
          {weekDays.map((day) => (
            <div
              key={day}
              role="columnheader"
              className="p-1.5 text-center text-xs font-semibold text-muted bg-paper rounded"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Linhas de horários */}
        {times.map((time) => (
          <div key={time} role="row" className="contents">
            <div
              role="rowheader"
              className="flex items-center justify-center font-mono text-[11px] font-medium text-muted bg-paper/70 rounded px-1 text-center"
            >
              {time}
            </div>
            {weekDays.map((day) => {
              const key = slotKey(nivel, day, time)
              const state = slots[key] ?? 'indisponivel'
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  onClick={() => onToggle(key)}
                  aria-label={`${day}, ${time}: ${slotStyles[state].label}`}
                  className={cn(
                    'h-[34px] rounded flex items-center justify-center text-[11px] transition-all cursor-pointer select-none',
                    slotStyles[state].className,
                  )}
                >
                  {state === 'disponivel' && '✓'}
                  {state === 'preferencial' && '★'}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function buildDefaultSlots(niveis: NivelEnsinoSchedule[]): Record<string, SlotState> {
  const slots: Record<string, SlotState> = {}
  for (const nivel of niveis) {
    const timesData = timeSlotsByNivel[nivel] ?? timeSlotsByNivel['Anos Finais']
    for (const day of weekDays) {
      for (const time of timesData.manha) {
        const isPref = time === timesData.manha[0]
        slots[slotKey(nivel, day, time)] = isPref ? 'preferencial' : 'disponivel'
      }
      for (const time of timesData.tarde) {
        slots[slotKey(nivel, day, time)] = 'indisponivel'
      }
    }
  }
  return slots
}
