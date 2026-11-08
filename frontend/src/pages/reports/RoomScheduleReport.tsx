import { cn } from '@/lib/cn'
import { getSubjectColor, shortTeacherName, weekDays } from '@/lib/schedule'
import { ReportSection } from './ReportSection'
import { horarioBloqueado, horariosDaSala, percentual, type OcupacaoSala } from './reportMetrics'

interface RoomScheduleReportProps {
  ocupacao: OcupacaoSala
  horariosTurmas: Record<number, string[]>
}

/** Semana de uma sala: aulas e horários bloqueados, com a ocupação no topo. */
export function RoomScheduleReport({ ocupacao, horariosTurmas }: RoomScheduleReportProps) {
  const { nome, tipo, capacidade, aulas, indisponibilidades, minutosOcupados, minutosDisponiveis } = ocupacao
  const horarios = horariosDaSala(ocupacao, horariosTurmas)
  const resumo = [
    tipo,
    capacidade != null && `${capacidade} lugares`,
    `${aulas.length} aulas`,
    `${percentual(minutosOcupados, minutosDisponiveis)}% de ocupação`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <ReportSection title={nome} summary={resumo}>
      {horarios.length === 0 ? (
        <p className="text-[13px] text-muted">Sem aulas nesta grade.</p>
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
                    const naCelula = aulas.filter((a) => a.day === dia && a.time === horario)
                    const bloqueio = indisponibilidades.find(
                      (i) => i.dia_semana === dia && horarioBloqueado(horario, i),
                    )
                    return (
                      <td key={dia} className="p-1 align-top">
                        {naCelula.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {naCelula.map((aula) => (
                              <div key={aula.id} className={cn('rounded-[5px] px-2 py-1.5', getSubjectColor(aula.subject))}>
                                <span className="block font-semibold">{aula.subject}</span>
                                <span className="block text-muted">
                                  {aula.classGroup}
                                  {aula.teachers.length > 0 &&
                                    ` · ${aula.teachers.map((t) => shortTeacherName(t.nome)).join(' + ')}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : bloqueio ? (
                          <div className="rounded-[5px] border border-dashed border-line px-2 py-1.5 text-muted">
                            <span className="block font-semibold">Bloqueada</span>
                            {bloqueio.motivo && <span className="block text-[11px]">{bloqueio.motivo}</span>}
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
    </ReportSection>
  )
}
