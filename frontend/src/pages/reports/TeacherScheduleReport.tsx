import type { JanelaProfessor, PlanejamentoGrade } from '@/api/grades'
import { cn } from '@/lib/cn'
import { getSubjectColor, splitHorario, weekDays } from '@/lib/schedule'
import type { Lesson } from '@/schedule/ScheduleContext'

// Vagos menores que isso são o recreio ou a troca de turno e não aparecem
const MIN_LIVRE = 30

/** Minutos do início (lado 0) ou do fim (lado 1) de um horário "HH:MM - HH:MM". */
function minutos(horario: string, lado: 0 | 1) {
  const [h, m] = splitHorario(horario)[lado].split(':').map(Number)
  return h * 60 + m
}

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

  // Uma coluna por dia com as atividades em ordem de horário. Quem dá aula em níveis diferentes
  // tem horários que se sobrepõem (ex.: 09:00 e 09:15); numa tabela por linha de horário,
  // as linhas do outro nível apareceriam vazias como se fossem janelas.
  const dias = weekDays.map((dia) => ({
    dia,
    itens: [
      ...aulas.filter((a) => a.day === dia).map((aula) => ({ horario: aula.time, aula })),
      ...planos.filter((p) => p.dia_semana === dia).map((plano) => ({ horario: plano.horario, plano })),
      ...vagos.filter((j) => j.dia_semana === dia).map((j) => ({ horario: j.horario, janela: true })),
    ].sort((a, b) => a.horario.localeCompare(b.horario)),
  }))
  const temItens = dias.some((d) => d.itens.length > 0)

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

      {!temItens ? (
        <p className="text-[13px] text-muted">Sem aulas nem planejamentos nesta grade.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-5 gap-2 text-[12px]">
            {dias.map(({ dia, itens }) => (
              <div key={dia}>
                <h3 className="mb-1.5 rounded-[5px] bg-paper p-2 text-center font-semibold">{dia}</h3>
                {itens.length === 0 && <p className="px-2 py-1.5 text-center text-muted">Sem aulas</p>}
                <ol className="space-y-1">
                  {itens.map((item, i) => {
                    const fimAnterior = Math.max(0, ...itens.slice(0, i).map((x) => minutos(x.horario, 1)))
                    const livre = i > 0 ? minutos(item.horario, 0) - fimAnterior : 0
                    return (
                      <li key={`${item.horario}-${i}`}>
                        {/* Intervalo maior que um recreio (ex.: almoço) */}
                        {livre >= MIN_LIVRE && (
                          <p className="mb-1 border-y border-dashed border-line-soft py-1 text-center text-[11px] text-muted">
                            livre · {livre} min
                          </p>
                        )}
                        <ItemAgenda professor={professor} {...item} />
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

interface ItemAgendaProps {
  horario: string
  professor: string
  aula?: Lesson
  plano?: PlanejamentoGrade
  janela?: boolean
}

function ItemAgenda({ horario, professor, aula, plano, janela }: ItemAgendaProps) {
  const hora = <span className="block font-mono text-[11px] text-muted">{horario}</span>
  if (aula) {
    return (
      <div className={cn('rounded-[5px] px-2 py-1.5', getSubjectColor(aula.subject))}>
        {hora}
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
    )
  }
  if (plano) {
    return (
      <div className="rounded-[5px] border border-dashed border-line px-2 py-1.5">
        {hora}
        <span className="block font-semibold">Planejamento</span>
        {plano.compartilhado && <span className="block text-[11px] text-primary">compartilhado</span>}
      </div>
    )
  }
  return janela ? (
    <div className="rounded-[5px] border border-warning/40 bg-warning-soft px-2 py-1.5 font-semibold text-warning">
      {hora}
      Janela
    </div>
  ) : null
}
