import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  conflicts as initialConflicts,
  lessons as initialLessons,
  shortTeacherName,
  type LessonChanges,
} from '@/mocks/schedule'
import { ScheduleContext, type ScheduleContextValue, type UpdateResult } from './ScheduleContext'

// Estado só em memória: sobrevive à navegação, some ao recarregar ou sair.
export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [lessons, setLessons] = useState(initialLessons)
  const [conflicts, setConflicts] = useState(initialConflicts)

  const updateLesson = useCallback(
    (id: string, changes: LessonChanges): UpdateResult => {
      const current = lessons.find((l) => l.id === id)
      if (!current) return { ok: false, error: 'Aula não encontrada.' }

      const next = { ...current, ...changes }
      const clash = lessons.find(
        (l) => l.id !== id && l.classGroup === next.classGroup && l.day === next.day && l.time === next.time,
      )
      if (clash) {
        return {
          ok: false,
          error: `Horário ocupado por ${clash.subject} (${shortTeacherName(clash.teacher)}) em ${clash.day}, ${clash.time}.`,
        }
      }

      setLessons((prev) => prev.map((l) => (l.id === id ? next : l)))
      // Edição manual de uma aula conta como resolução dos conflitos ligados a ela.
      setConflicts((prev) => prev.filter((c) => c.lessonId !== id))
      return { ok: true }
    },
    [lessons],
  )

  const applySuggestion = useCallback(
    (conflictId: string): UpdateResult => {
      const conflict = conflicts.find((c) => c.id === conflictId)
      if (!conflict) return { ok: false, error: 'Conflito não encontrado.' }
      const result = updateLesson(conflict.lessonId, conflict.fix)
      if (result.ok) setConflicts((prev) => prev.filter((c) => c.id !== conflictId))
      return result
    },
    [conflicts, updateLesson],
  )

  const value = useMemo<ScheduleContextValue>(
    () => ({ lessons, conflicts, updateLesson, applySuggestion }),
    [lessons, conflicts, updateLesson, applySuggestion],
  )

  return <ScheduleContext value={value}>{children}</ScheduleContext>
}
