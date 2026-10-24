import { createContext } from 'react'
import type { ConflitoGrade, GradeBackend } from '@/api/grades'

/** Aula da grade gravada no core-service */
export interface Lesson {
  id: number
  turmaId: number
  classGroup: string
  day: string
  time: string
  subject: string
  teacher: string | null
  teacherId: number | null
  room: string | null
}

export interface LessonChanges {
  day: string
  time: string
  teacherId: number | null
  room: string | null
}

export type UpdateResult = { ok: true } | { ok: false; error: string }

export interface ScheduleContextValue {
  lessons: Lesson[]
  conflicts: ConflitoGrade[]
  isLoading: boolean
  /** Grade exibida (nula se nenhuma foi gerada) */
  activeGrade: GradeBackend | null
  /** Horários de cada turma da grade (turma_id -> horários) */
  horariosTurmas: Record<number, string[]>
  refreshSchedule: (gradeId?: number) => Promise<void>
  /** Salva professor, sala, dia e horário da aula. Falha se a turma já tiver aula no novo horário. */
  updateLesson: (id: number, changes: LessonChanges) => Promise<UpdateResult>
  /** Move a aula do conflito para o horário livre sugerido pelo backend. */
  applySuggestion: (conflictId: string) => Promise<UpdateResult>
}

export const ScheduleContext = createContext<ScheduleContextValue | null>(null)
