import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import {
  timeSlotsByNivel,
  weekDays,
  type NivelEnsinoSchedule,
} from '@/mocks/data'

type SlotState = 'indisponivel' | 'disponivel' | 'preferencial'

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

const slotKey = (nivel: string, day: string, time: string) => `${nivel}__${day}__${time}`

export function AvailabilityPage() {
  const { user } = useAuth()
  const [activeNivel, setActiveNivel] = useState<NivelEnsinoSchedule>('Anos Finais')
  const [slots, setSlots] = useState<Record<string, SlotState>>({})

  const toggle = (key: string) =>
    setSlots((prev) => ({ ...prev, [key]: nextState[prev[key] ?? 'indisponivel'] }))

  const currentSchedule = timeSlotsByNivel[activeNivel]

  return (
    <>
      <PageHeader
        title={`Disponibilidade — ${user?.name}`}
        description="Clique nos horários em que você pode dar aula conforme o nível de ensino. Marque horários como preferenciais ou indisponíveis."
      />

      {/* Seleção de Nível de Ensino */}
      <div className="mb-5 flex flex-wrap gap-2 border-b border-line pb-3">
        {(['Anos Iniciais', 'Anos Finais', 'Ensino Médio'] as const).map((nivel) => (
          <button
            key={nivel}
            type="button"
            onClick={() => setActiveNivel(nivel)}
            className={cn(
              'rounded-md px-4 py-2 text-xs font-semibold transition-colors',
              activeNivel === nivel
                ? 'bg-navy text-white shadow-xs'
                : 'bg-paper text-muted hover:text-ink hover:bg-line-soft',
            )}
          >
            {nivel}
          </button>
        ))}
      </div>

      <div className="space-y-6 max-w-[700px]">
        {/* Turno da Manhã */}
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-3 text-xs font-bold text-ink uppercase tracking-wider">
            Turno da Manhã ({activeNivel})
          </h2>
          <ScheduleTable
            nivel={activeNivel}
            times={currentSchedule.manha}
            slots={slots}
            onToggle={toggle}
          />
        </section>

        {/* Turno da Tarde */}
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-3 text-xs font-bold text-ink uppercase tracking-wider">
            Turno da Tarde ({activeNivel})
          </h2>
          <ScheduleTable
            nivel={activeNivel}
            times={currentSchedule.tarde}
            slots={slots}
            onToggle={toggle}
          />
        </section>
      </div>

      <ul className="mt-5 flex flex-wrap items-center gap-5 text-[12.5px] text-muted">
        {(['disponivel', 'preferencial', 'indisponivel'] as const).map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={cn('inline-block size-3.5 rounded-[3px]', slotStyles[state].className)} />
            {slotStyles[state].label}
          </li>
        ))}
      </ul>

      <Button size="lg" className="mt-6" disabled title="Em breve">
        Salvar disponibilidade
      </Button>
    </>
  )
}

function ScheduleTable({
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
        aria-label={`Grade de disponibilidade ${nivel}`}
        className="grid min-w-[500px] grid-cols-[100px_repeat(5,1fr)] gap-1.5"
      >
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
              );
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
