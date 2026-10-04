import { createContext } from 'react'
import type { Conflict, Lesson, LessonChanges } from '@/mocks/schedule'

export type UpdateResult = { ok: true } | { ok: false; error: string }

export interface ScheduleContextValue {
  lessons: Lesson[]
  conflicts: Conflict[]
  /** Reatribui professor, sala ou horário. Falha se a turma já tiver aula no novo horário. */
  updateLesson: (id: string, changes: LessonChanges) => UpdateResult
  /** Aplica a correção sugerida e remove o conflito. */
  applySuggestion: (conflictId: string) => UpdateResult
}

export const ScheduleContext = createContext<ScheduleContextValue | null>(null)
