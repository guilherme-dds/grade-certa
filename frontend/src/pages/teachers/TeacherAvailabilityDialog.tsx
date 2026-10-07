import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { timeSlots, weekDays } from '@/mocks/data'
import { type Teacher } from '@/mocks/teachers'

export type SlotState = 'indisponivel' | 'disponivel' | 'preferencial'

const slotStyles: Record<SlotState, { label: string; className: string }> = {
  disponivel: { label: 'Disponível', className: 'bg-primary text-white font-medium' },
  preferencial: { label: 'Preferencial', className: 'border-2 border-warning bg-warning-soft text-warning font-semibold' },
  indisponivel: { label: 'Indisponível', className: 'bg-line-soft hover:bg-line text-muted' },
}

const nextState: Record<SlotState, SlotState> = {
  indisponivel: 'disponivel',
  disponivel: 'preferencial',
  preferencial: 'indisponivel',
}

const slotKey = (day: string, time: string) => `${day}-${time}`

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

  // Slots padrão (exemplo: manhãs disponíveis por padrão se não houver slots gravados)
  const defaultSlots = useMemoDefaultSlots()
  const [slots, setSlots] = useState<Record<string, SlotState>>(initialSlots ?? defaultSlots)
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

  const handleSetAllMorning = () => {
    const morningTimes = ['07:00', '07:50', '08:40', '09:30']
    const updated = { ...slots }
    for (const day of weekDays) {
      for (const time of morningTimes) {
        updated[slotKey(day, time)] = 'disponivel'
      }
    }
    setSlots(updated)
  }

  const handleClearAll = () => {
    const updated: Record<string, SlotState> = {}
    for (const day of weekDays) {
      for (const time of timeSlots) {
        updated[slotKey(day, time)] = 'indisponivel'
      }
    }
    setSlots(updated)
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
      className="m-auto w-[min(640px,calc(100%-2rem))] rounded-lg border border-line bg-white p-0 text-ink shadow-lg backdrop:bg-black/40"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="availability-dialog-title" className="text-[17px] font-semibold">
              Horários de Disponibilidade — {teacher.name}
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Clique nas células para alternar entre <strong>Disponível</strong>, <strong>Preferencial</strong> ou <strong>Indisponível</strong>.
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

        {/* Barra de Ações Rápidas */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-soft bg-paper p-2.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSetAllMorning}
              className="rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-paper transition-colors"
            >
              + Marcar Manhãs
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-muted hover:text-danger transition-colors"
            >
              Limpar Tudo
            </button>
          </div>
          <span className="text-[11px] text-muted">
            Clique na célula para alternar o estado.
          </span>
        </div>

        {/* Grade Semanal */}
        <div className="mt-4 overflow-x-auto">
          <div
            role="grid"
            aria-label="Grade de disponibilidade"
            className="grid min-w-[500px] grid-cols-[65px_repeat(5,1fr)] gap-1.5"
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

            {/* Linhas por horário */}
            {timeSlots.map((time) => (
              <div key={time} role="row" className="contents">
                <div
                  role="rowheader"
                  className="flex items-center justify-center font-mono text-[11px] font-medium text-muted bg-paper/60 rounded px-1"
                >
                  {time}
                </div>
                {weekDays.map((day) => {
                  const key = slotKey(day, time)
                  const state = slots[key] ?? 'indisponivel'
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      onClick={() => toggle(key)}
                      aria-label={`${day}, ${time}: ${slotStyles[state].label}`}
                      className={cn(
                        'h-[36px] rounded flex items-center justify-center text-[10.5px] transition-all cursor-pointer select-none',
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

        {/* Legenda de Cores */}
        <ul className="mt-4 flex flex-wrap items-center justify-between border-t border-line-soft pt-3 text-[12px] text-muted">
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded bg-primary" />
            <span>Disponível (✓)</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded border-2 border-warning bg-warning-soft" />
            <span>Preferencial (★)</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded bg-line-soft" />
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

function useMemoDefaultSlots(): Record<string, SlotState> {
  const slots: Record<string, SlotState> = {}
  for (const day of weekDays) {
    for (const time of timeSlots) {
      const isMorning = time === '07:00' || time === '07:50' || time === '08:40'
      const isPref = time === '07:00'
      slots[slotKey(day, time)] = isPref ? 'preferencial' : isMorning ? 'disponivel' : 'indisponivel'
    }
  }
  return slots
}
