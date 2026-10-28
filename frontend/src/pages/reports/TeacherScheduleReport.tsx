import type { JanelaProfessor, PlanejamentoGrade } from '@/api/grades'
import { cn } from '@/lib/cn'
import { getSubjectColor, weekDays } from '@/lib/schedule'
import type { Lesson } from '@/schedule/ScheduleContext'

interface TeacherScheduleReportProps {
  professor: string
  lessons: Lesson[]
  planejamentos: PlanejamentoGrade[]
  janelas: JanelaProfessor[]
}

/** Semana de um professor: aulas, planejamentos e janelas, com um resumo no topo. */
export function TeacherScheduleReport({ professor, lessons, planejamentos, janelas }: TeacherScheduleReportProps) {
  const aulas = lessons.filter((l) => l.teachers.some((t) => t.nome === professor))
  const planos = planejamentos.filter((p) => p.professor === professor)
  const vagos = janelas.filter((j) => j.professor === professor)

  // Linhas: todos os horários em que o professor tem algo. Quem dá aula em níveis diferentes
  // pode ter horários que se sobrepõem (ex.: 09:00 e 09:15), e cada um vira uma linha.
  const horarios = Array.from(
    new Set([...aulas.map((a) => a.time), ...planos.map((p) => p.horario), ...vagos.map((j) => j.horario)]),
  ).sort()

  const turmas = Array.from(new Set(aulas.map((a) => a.classGroup))).sort()
  const compartilhados = planos.filter((p) => p.compartilhado).length

  return (
    <section className="rounded-lg border border-line bg-white p-5 print:break-after-page print:border-0 print:p-0">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{professor}</h2>
        <p className="text-[12.5px] text-muted">
          {aulas.length} aulas · {planos.length} planejamentos
          {planos.length > 0 && ` (${compartilhados} compartilhados)`} ·{' '}
          {vagos.length === 0 ? 'sem janelas' : `${vagos.length} janela(s)`}
        </p>
      </header>
      {turmas.length > 0 && <p className="mb-3 text-[12.5px] text-muted">Turmas: {turmas.join(', ')}</p>}

      {horarios.length === 0 ? (
        <p className="text-[13px] text-muted">Sem aulas nem planejamentos nesta grade.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-[12px]">
            <thead>
              <tr className="bg-paper">
                <th scope="col" className="w-[100px] p-2 text-left font-semibold text-muted">
                  Horário
                </th>
                {weekDays.map((dia) => (
                  <th key={dia} scope="col" className="p-2 font-semibold">
                    {dia}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horarios.map((horario) => (
                <tr key={horario} className="border-t border-line-soft">
                  <th scope="row" className="p-2 text-left font-mono font-normal whitespace-nowrap text-muted">
                    {horario}
                  </th>
                  {weekDays.map((dia) => {
                    const aula = aulas.find((a) => a.day === dia && a.time === horario)
                    const plano = planos.find((p) => p.dia_semana === dia && p.horario === horario)
                    const janela = vagos.some((j) => j.dia_semana === dia && j.horario === horario)
                    return (
                      <td key={dia} className="p-1 align-top">
                        {aula ? (
                          <div className={cn('rounded-[5px] px-2 py-1.5', getSubjectColor(aula.subject))}>
                            <span className="block font-semibold">{aula.subject}</span>
                            <span className="block text-muted">
                              {aula.classGroup}
                              {aula.room && ` · ${aula.room}`}
                            </span>
                            {aula.teachers.length > 1 && (
                              <span className="block text-[11px] text-muted">
                                com {aula.teachers.filter((t) => t.nome !== professor).map((t) => t.nome).join(', ')}
                              </span>
                            )}
                          </div>
                        ) : plano ? (
                          <div className="rounded-[5px] border border-dashed border-line px-2 py-1.5">
                            <span className="block font-semibold">Planejamento</span>
                            {plano.compartilhado && <span className="block text-[11px] text-primary">compartilhado</span>}
                          </div>
                        ) : janela ? (
                          <div className="rounded-[5px] border border-warning/40 bg-warning-soft px-2 py-1.5 font-semibold text-warning">
                            Janela
                          </div>
                        ) : (
                          <div className="px-2 py-1.5 text-center text-line">—</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
