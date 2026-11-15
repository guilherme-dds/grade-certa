import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import type { HorariosEscola } from '@/api/grades'
import { slotKey, type AvailabilitySlots, type SlotState } from '@/lib/availability'
import { cn } from '@/lib/cn'
import { weekDays, type NivelEnsino } from '@/lib/schedule'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const slotStyles: Record<SlotState, { label: string; cell: string; swatch: string; mark: string }> = {
  indisponivel: {
    label: 'Indisponível',
    cell: 'bg-ink text-white/70 hover:bg-ink-soft',
    swatch: 'bg-ink',
    mark: '×',
  },
  evitar: {
    label: 'Evitar',
    cell: 'bg-warning-soft text-warning ring-1 ring-inset ring-warning/30 hover:bg-warning/15',
    swatch: 'bg-warning-soft ring-1 ring-inset ring-warning/40',
    mark: '!',
  },
  disponivel: {
    label: 'Livre',
    cell: 'bg-paper text-transparent hover:bg-line-soft',
    swatch: 'bg-paper ring-1 ring-inset ring-line',
    mark: '',
  },
}

const brushes: SlotState[] = ['indisponivel', 'evitar', 'disponivel']

export type SlotsUpdater = (update: (prev: AvailabilitySlots) => AvailabilitySlots) => void

interface AvailabilityGridProps {
  niveis: readonly NivelEnsino[]
  horarios: HorariosEscola
  slots: AvailabilitySlots
  onChange: SlotsUpdater
}

/**
 * Quadro semanal de disponibilidade. Escolhe-se um "pincel" (indisponível, evitar ou livre)
 * e clica-se ou arrasta-se sobre os horários; clicar de novo num horário já marcado o libera.
 */
export function AvailabilityGrid({ niveis, horarios, slots, onChange }: AvailabilityGridProps) {
  const [activeNivel, setActiveNivel] = useState<NivelEnsino>(niveis[0])
  const [brush, setBrush] = useState<SlotState>('indisponivel')
  const current = horarios.niveis[activeNivel] ?? { manha: [], tarde: [] }

  // Estado aplicado enquanto o botão do mouse está pressionado (arrastar pinta vários horários)
  const painting = useRef<SlotState | null>(null)
  useEffect(() => {
    const stop = () => (painting.current = null)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  const paint = (key: string, state: SlotState) => onChange((prev) => ({ ...prev, [key]: state }))
  const targetFor = (key: string) => ((slots[key] ?? 'disponivel') === brush ? 'disponivel' : brush)

  const setMany = (times: readonly string[], state: SlotState) =>
    onChange((prev) => {
      const updated = { ...prev }
      for (const day of weekDays) for (const time of times) updated[slotKey(activeNivel, day, time)] = state
      return updated
    })

  const all = [...current.manha, ...current.tarde]
  const count = (state: SlotState) =>
    weekDays.reduce(
      (acc, day) => acc + all.filter((t) => (slots[slotKey(activeNivel, day, t)] ?? 'disponivel') === state).length,
      0,
    )

  const cellHandlers = (key: string) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      // Libera a captura para que os horários vizinhos recebam o "pointerenter" do arraste
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      const state = targetFor(key)
      painting.current = state
      paint(key, state)
    },
    onPointerEnter: () => painting.current && paint(key, painting.current),
    // Teclado (Enter/Espaço) não dispara pointerdown
    onClick: (e: MouseEvent) => e.detail === 0 && paint(key, targetFor(key)),
  })

  return (
    <div>
      {niveis.length > 1 && (
        <div role="tablist" aria-label="Nível de ensino" className="mb-4 inline-flex gap-1 rounded-full bg-paper p-1">
          {niveis.map((nivel) => (
            <button
              key={nivel}
              type="button"
              role="tab"
              aria-selected={activeNivel === nivel}
              onClick={() => setActiveNivel(nivel)}
              className={cn(
                'rounded-full px-4 py-1.5 text-[13.5px] transition-colors',
                activeNivel === nivel ? 'bg-ink font-semibold text-white' : 'text-muted hover:text-ink',
              )}
            >
              {nivel}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Marcar horários como" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] text-muted">Marcar como</span>
          {brushes.map((state) => (
            <button
              key={state}
              type="button"
              role="radio"
              aria-checked={brush === state}
              onClick={() => setBrush(state)}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13.5px] transition-colors',
                brush === state ? 'border-ink bg-white font-semibold shadow-xs' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              <span className={cn('size-3.5 rounded-[4px]', slotStyles[state].swatch)} />
              {slotStyles[state].label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <QuickAction onClick={() => setMany(current.manha, brush)}>Manhã inteira</QuickAction>
          <QuickAction onClick={() => setMany(current.tarde, brush)}>Tarde inteira</QuickAction>
          <QuickAction onClick={() => setMany(all, 'disponivel')}>Liberar tudo</QuickAction>
        </div>
      </div>

      <p className="mt-3 text-[13px] text-muted">
        Clique ou arraste sobre os horários. {plural(count('indisponivel'), 'indisponível', 'indisponíveis')} e{' '}
        {count('evitar')} a evitar em {activeNivel}; o resto está livre. Horários a evitar só recebem aula se não
        houver outro jeito.
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {(['manha', 'tarde'] as const).map((turno) =>
          current[turno].length ? (
            <section key={turno} aria-label={turno === 'manha' ? 'Manhã' : 'Tarde'}>
              <h3 className="mb-2 font-display text-[15px] font-bold">{turno === 'manha' ? 'Manhã' : 'Tarde'}</h3>
              <div role="grid" aria-label={`${turno === 'manha' ? 'Manhã' : 'Tarde'}, ${activeNivel}`} className="select-none">
                <div role="row" className="grid grid-cols-[84px_repeat(5,1fr)] gap-1">
                  <div role="columnheader" />
                  {weekDays.map((day) => (
                    <div key={day} role="columnheader" className="pb-1 text-center text-[12.5px] font-semibold text-muted">
                      {day}
                    </div>
                  ))}
                </div>
                {current[turno].map((time) => (
                  <div key={time} role="row" className="mt-1 grid grid-cols-[84px_repeat(5,1fr)] gap-1">
                    <div role="rowheader" className="flex items-center text-[12px] text-muted tabular-nums">
                      {time}
                    </div>
                    {weekDays.map((day) => {
                      const key = slotKey(activeNivel, day, time)
                      const state = slots[key] ?? 'disponivel'
                      return (
                        <button
                          key={key}
                          type="button"
                          role="gridcell"
                          aria-label={`${day}, ${time}: ${slotStyles[state].label}`}
                          {...cellHandlers(key)}
                          className={cn(
                            'h-9 cursor-pointer rounded-lg text-[13px] font-semibold transition-colors',
                            slotStyles[state].cell,
                          )}
                        >
                          {slotStyles[state].mark}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </section>
          ) : null,
        )}
      </div>
    </div>
  )
}

function QuickAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 rounded-full border border-line bg-white px-3.5 text-[13px] font-medium transition-colors hover:border-ink/25 hover:bg-paper"
    >
      {children}
    </button>
  )
}
