import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] md:grid-cols-[minmax(280px,1fr)_minmax(320px,420px)]">
        <section className="bg-navy px-8 py-10 text-white md:px-10 md:py-12">
          <p className="text-[22px] font-bold">GradeCerta</p>
          <p className="mt-6 max-w-[280px] text-[15px] leading-relaxed text-white/75">
            Geração automática de grade horária, respeitando disponibilidade docente e regras de
            descanso entre turnos.
          </p>
        </section>
        <section className="flex flex-col justify-center bg-white px-8 py-10 md:px-10 md:py-12">
          <Outlet />
        </section>
      </div>
    </main>
  )
}
