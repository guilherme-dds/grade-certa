import { useState, type ReactNode } from 'react'
import type { HorariosEscola } from '@/api/grades'
import { slotKey, type AvailabilitySlots, type SlotState } from '@/lib/availability'
import { cn } from '@/lib/cn'
import { weekDays, type NivelEnsino } from '@/lib/schedule'

const slotStyles: Record<SlotState, { label: string; className: string }> = {
  disponivel: { label: 'Disponível', className: 'bg-primary text-white font-medium' },
  preferencial: {
    label: 'Preferencial',
    className: 'border-2 border-warning bg-warning-soft text-warning font-semibold',
  },
  indisponivel: { label: 'Indisponível', className: 'bg-line-soft hover:bg-line text-muted' },
}

const nextState: Record<SlotState, SlotState> = {
  disponivel: 'preferencial',
  preferencial: 'indisponivel',
  indisponivel: 'disponivel',
}

interface AvailabilityGridProps {
  niveis: readonly NivelEnsino[]
  horarios: HorariosEscola
  slots: AvailabilitySlots
  onChange: (slots: AvailabilitySlots) => void
}

export function AvailabilityGrid({ niveis, horarios, slots, onChange }: AvailabilityGridProps) {
  const [activeNivel, setActiveNivel] = useState<NivelEnsino>(niveis[0])
  const current = horarios.niveis[activeNivel] ?? { manha: [], tarde: [] }

  const toggle = (key: string) => onChange({ ...slots, [key]: nextState[slots[key] ?? 'disponivel'] })

  const setMany = (times: readonly string[], state: SlotState) => {
    const updated = { ...slots }
    for (const day of weekDays) {
      for (const time of times) updated[slotKey(activeNivel, day, time)] = state
    }
    onChange(updated)
  }

  return (
    <div>
      {niveis.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5 border-b border-line pb-2">
          {niveis.map((nivel) => (
            <button
              key={nivel}
              type="button"
              onClick={() => setActiveNivel(nivel)}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors',
                activeNivel === nivel
                  ? 'bg-navy text-white shadow-xs'
                  : 'bg-paper text-muted hover:bg-line-soft hover:text-ink',
              )}
            >
              {nivel}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-soft bg-paper p-2.5">
        <div className="flex flex-wrap gap-2">
          <QuickAction onClick={() => setMany(current.manha, 'indisponivel')}>Manhã indisponível</QuickAction>
          <QuickAction onClick={() => setMany(current.tarde, 'indisponivel')}>Tarde indisponível</QuickAction>
          <QuickAction onClick={() => setMany([...current.manha, ...current.tarde], 'disponivel')}>
            Liberar {activeNivel}
          </QuickAction>
        </div>
        <span className="text-[11px] text-muted">Clique na célula para alternar o estado.</span>
      </div>

      <div className="mt-4 space-y-5">
        {(['manha', 'tarde'] as const).map((turno) => (
          <div key={turno}>
            <h3 className="mb-2 text-xs font-bold tracking-wider text-ink uppercase">
              Turno da {turno === 'manha' ? 'Manhã' : 'Tarde'} ({activeNivel})
            </h3>
            <SlotTable nivel={activeNivel} times={current[turno]} slots={slots} onToggle={toggle} />
          </div>
        ))}
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-5 border-t border-line-soft pt-3 text-[12px] text-muted">
        {(['disponivel', 'preferencial', 'indisponivel'] as const).map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={cn('inline-block size-3.5 rounded-[3px]', slotStyles[state].className)} />
            {slotStyles[state].label}
            {state === 'preferencial' && ' (o gerador prioriza)'}
          </li>
        ))}
      </ul>
    </div>
  )
}

function QuickAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-paper"
    >
      {children}
    </button>
  )
}

function SlotTable({
  nivel,
  times,
  slots,
  onToggle,
}: {
  nivel: string
  times: readonly string[]
  slots: AvailabilitySlots
  onToggle: (key: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div
        role="grid"
        aria-label={`Disponibilidade ${nivel}`}
        className="grid min-w-[500px] grid-cols-[100px_repeat(5,1fr)] gap-1.5"
      >
        <div role="row" className="contents">
          <div role="columnheader" />
          {weekDays.map((day) => (
            <div key={day} role="columnheader" className="rounded bg-paper p-1.5 text-center text-xs font-semibold text-muted">
              {day}
            </div>
          ))}
        </div>

        {times.map((time) => (
          <div key={time} role="row" className="contents">
            <div
              role="rowheader"
              className="flex items-center justify-center rounded bg-paper/70 px-1 text-center font-mono text-[11px] font-medium text-muted"
            >
              {time}
            </div>
            {weekDays.map((day) => {
              const key = slotKey(nivel, day, time)
              const state = slots[key] ?? 'disponivel'
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  onClick={() => onToggle(key)}
                  aria-label={`${day}, ${time}: ${slotStyles[state].label}`}
                  className={cn(
                    'flex h-[34px] cursor-pointer items-center justify-center rounded text-[11px] transition-all select-none',
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
