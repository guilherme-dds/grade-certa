import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { timeSlots, weekDays } from '@/mocks/data'

type SlotState = 'indisponivel' | 'disponivel' | 'preferencial'

const slotStyles: Record<SlotState, { label: string; className: string }> = {
  disponivel: { label: 'Disponível', className: 'bg-primary' },
  preferencial: { label: 'Preferencial', className: 'border-2 border-warning bg-white' },
  indisponivel: { label: 'Indisponível', className: 'bg-line-soft hover:bg-line' },
}

// Cada clique avança: indisponível → disponível → preferencial → indisponível
const nextState: Record<SlotState, SlotState> = {
  indisponivel: 'disponivel',
  disponivel: 'preferencial',
  preferencial: 'indisponivel',
}

const slotKey = (day: string, time: string) => `${day}-${time}`

export function AvailabilityPage() {
  const { user } = useAuth()
  const [slots, setSlots] = useState<Record<string, SlotState>>({})

  const toggle = (key: string) =>
    setSlots((prev) => ({ ...prev, [key]: nextState[prev[key] ?? 'indisponivel'] }))

  return (
    <>
      <PageHeader
        title={`Disponibilidade — ${user?.name}`}
        description="Clique nos horários em que você pode dar aula; clique de novo para marcar como preferencial. Regra da escola: máximo de 4 aulas consecutivas e intervalo mínimo de 15 minutos entre turnos."
      />

      <div className="overflow-x-auto">
        <div role="grid" aria-label="Disponibilidade semanal" className="grid min-w-[480px] max-w-[640px] grid-cols-[70px_repeat(5,1fr)] gap-1">
          <div role="row" className="contents">
            <div role="columnheader" />
            {weekDays.map((day) => (
              <div key={day} role="columnheader" className="p-1.5 text-center text-xs font-semibold text-muted">
                {day}
              </div>
            ))}
          </div>

          {timeSlots.map((time) => (
            <div key={time} role="row" className="contents">
              <div role="rowheader" className="flex items-center font-mono text-[11px] text-muted">
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
                      'h-[34px] rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy',
                      slotStyles[state].className,
                    )}
                  />
                )
              })}
            </div>
          ))}
        </div>
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
