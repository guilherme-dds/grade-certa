import { useMemo } from 'react'
import { weekDays } from '@/lib/schedule'
import type { Lesson } from '@/schedule/ScheduleContext'

/**
 * "Lousa" da semana: mapa de calor com quantas aulas a grade tem em cada
 * dia × horário. Cada célula é desenhada com a intensidade do giz.
 */
export function WeekBoard({ lessons }: { lessons: Lesson[] }) {
  const { times, counts, max } = useMemo(() => {
    const byKey = new Map<string, number>()
    const timeSet = new Set<string>()
    for (const l of lessons) {
      timeSet.add(l.time)
      const key = `${l.day}|${l.time}`
      byKey.set(key, (byKey.get(key) ?? 0) + 1)
    }
    const sorted = [...timeSet].sort()
    return { times: sorted, counts: byKey, max: Math.max(1, ...byKey.values()) }
  }, [lessons])

  const empty = times.length === 0
  const dense = times.length > 10
  const rows = empty ? Array.from({ length: 6 }, (_, i) => `vazio-${i}`) : times

  return (
    <figure className="w-full" aria-label={empty ? 'Nenhuma aula na grade' : 'Distribuição das aulas na semana'}>
      <div className={`grid grid-cols-[44px_repeat(5,minmax(0,1fr))] ${dense ? 'gap-x-1.5 gap-y-1' : 'gap-1.5'}`}>
        <span />
        {weekDays.map((d) => (
          <span key={d} className="pb-1 text-center text-[12px] font-medium text-white/45">
            {d}
          </span>
        ))}

        {rows.map((time, r) => (
          <Row key={time} label={empty ? '' : time.split('-')[0].trim()}>
            {weekDays.map((day, c) => {
              const n = empty ? 0 : (counts.get(`${day}|${time}`) ?? 0)
              const alpha = n === 0 ? 0 : 0.2 + 0.8 * (n / max)
              return (
                <span
                  key={day}
                  title={empty ? undefined : `${day} ${time}: ${n} ${n === 1 ? 'aula' : 'aulas'}`}
                  className={`${dense ? 'h-[11px] rounded-[4px]' : 'h-[18px] rounded-[6px]'} motion-safe:animate-[chalk-in_420ms_cubic-bezier(.2,.8,.2,1)_both]`}
                  style={{
                    background: n === 0 ? 'rgb(255 255 255 / 0.06)' : `rgb(63 209 166 / ${alpha.toFixed(2)})`,
                    animationDelay: `${(r * 5 + c) * 18}ms`,
                  }}
                />
              )
            })}
          </Row>
        ))}
      </div>
    </figure>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="self-center text-[10.5px] leading-none text-white/35 tabular-nums">{label}</span>
      {children}
    </>
  )
}
