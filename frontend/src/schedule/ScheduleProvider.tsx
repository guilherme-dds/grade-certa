import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  conflicts as initialConflicts,
  shortTeacherName,
  type Lesson,
  type LessonChanges,
  type WeekDay,
} from '@/mocks/schedule'
import { getGrade, type GradeBackend } from '@/api/grades'
import { ScheduleContext, type ScheduleContextValue, type UpdateResult } from './ScheduleContext'

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [conflicts, setConflicts] = useState(initialConflicts)
  const [isLoading, setIsLoading] = useState(true)
  const [activeGrade, setActiveGrade] = useState<GradeBackend | null>(null)

  const refreshSchedule = useCallback(async (gradeId?: number) => {
    setIsLoading(true)
    try {
      const grade = await getGrade(gradeId)
      setActiveGrade(grade)
      if (grade && grade.aulas && grade.aulas.length > 0) {
        const mapped: Lesson[] = grade.aulas.map((aula) => ({
          id: String(aula.id ?? `${aula.turma_nome}-${aula.dia_semana}-${aula.horario}`),
          classGroup: aula.turma_nome,
          day: aula.dia_semana as WeekDay,
          time: aula.horario,
          subject: aula.disciplina_nome,
          teacher: aula.professor_nome || 'A definir',
          room: aula.sala_nome || 'Sala Padrão',
        }))
        setLessons(mapped)
        setConflicts([])
      } else {
        setLessons([])
      }
    } catch (err) {
      console.error('Erro ao carregar grade do backend:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSchedule()
  }, [refreshSchedule])

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
    () => ({
      lessons,
      conflicts,
      isLoading,
      activeGrade,
      refreshSchedule,
      updateLesson,
      applySuggestion,
    }),
    [lessons, conflicts, isLoading, activeGrade, refreshSchedule, updateLesson, applySuggestion],
  )

  return <ScheduleContext value={value}>{children}</ScheduleContext>
}
