import { Outlet } from 'react-router'
import { Logo } from '@/components/ui/Logo'
import { weekDays } from '@/lib/schedule'

// Uma semana ilustrativa: cada linha é um horário, cada coluna um dia
const SAMPLE = [
  [3, 3, 2, 3, 1],
  [2, 3, 3, 1, 3],
  [3, 1, 3, 3, 2],
  [0, 3, 2, 3, 3],
  [3, 2, 0, 2, 3],
]

export function AuthLayout() {
  return (
    <main className="flex min-h-svh items-center justify-center p-3 md:p-6">
      <div className="grid w-full max-w-[1040px] gap-3 md:grid-cols-[1.1fr_1fr]">
        <section className="relative flex min-h-[260px] flex-col overflow-hidden rounded-[28px] bg-board p-8 text-white md:min-h-[600px] md:p-10">
          <Logo inverted />

          <div className="mt-auto pt-10">
            <BoardSketch />
            <p className="mt-10 max-w-[420px] font-display text-[30px] leading-[1.1] font-bold tracking-[-0.02em] md:text-[40px]">
              A grade da escola, montada sem choque de horário.
            </p>
            <p className="mt-4 max-w-[400px] text-[15px] leading-relaxed text-white/60">
              Respeita a disponibilidade de cada professor, as salas e o descanso entre turnos.
            </p>
          </div>
        </section>

        <section className="card flex flex-col justify-center rounded-[28px] px-7 py-10 md:px-14">
          <div className="mx-auto w-full max-w-[360px]">
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  )
}

function BoardSketch() {
  return (
    <div className="hidden max-w-[340px] md:block" aria-hidden="true">
      <div className="mb-2 grid grid-cols-5 gap-1.5">
        {weekDays.map((d) => (
          <span key={d} className="text-center text-[11px] text-white/40">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {SAMPLE.flat().map((v, i) => (
          <span
            key={i}
            className="h-7 rounded-lg"
            style={{
              background: v === 0 ? 'rgb(255 255 255 / 0.05)' : `rgb(63 209 166 / ${0.18 + v * 0.22})`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
