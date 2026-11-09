import { ScheduleGrid } from '@/pages/schedule/ScheduleGrid'
import type { Lesson } from '@/schedule/ScheduleContext'
import { ReportSection } from './ReportSection'

interface ClassScheduleReportProps {
  turma: string
  lessons: Lesson[]
  horariosTurmas: Record<number, string[]>
}

/** Semana de uma turma, somente leitura. */
export function ClassScheduleReport({ turma, lessons, horariosTurmas }: ClassScheduleReportProps) {
  const aulas = lessons.filter((l) => l.classGroup === turma)
  const disciplinas = new Set(aulas.map((a) => a.subject)).size

  return (
    <ReportSection title={turma} summary={`${aulas.length} aulas · ${disciplinas} disciplinas`}>
      <ScheduleGrid lessons={aulas} timeSlots={aulas.length ? horariosTurmas[aulas[0].turmaId] : undefined} />
    </ReportSection>
  )
}
