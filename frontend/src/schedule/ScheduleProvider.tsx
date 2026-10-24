import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { editarAula, getConflitos, getGrade, type ConflitoGrade, type GradeBackend } from '@/api/grades'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  ScheduleContext,
  type Lesson,
  type LessonChanges,
  type ScheduleContextValue,
  type UpdateResult,
} from './ScheduleContext'

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [activeGrade, setActiveGrade] = useState<GradeBackend | null>(null)
  const [conflicts, setConflicts] = useState<ConflitoGrade[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async (gradeId?: number) => {
    const grade = await getGrade(gradeId)
    // O backend responde id 0 quando ainda não há grade gerada
    const exists = Boolean(grade?.id)
    setActiveGrade(exists ? grade : null)
    setConflicts(exists ? await getConflitos(grade.id!) : [])
  }, [])

  const refreshSchedule = useCallback(
    async (gradeId?: number) => {
      setIsLoading(true)
      try {
        await load(gradeId)
      } catch (err) {
        console.error('Erro ao carregar grade do backend:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [load],
  )

  useEffect(() => {
    refreshSchedule()
  }, [refreshSchedule])

  const lessons = useMemo<Lesson[]>(
    () =>
      (activeGrade?.aulas ?? []).map((aula) => ({
        id: aula.id!,
        turmaId: aula.turma_id,
        classGroup: aula.turma_nome,
        day: aula.dia_semana,
        time: aula.horario,
        subject: aula.disciplina_nome,
        teachers: aula.professores?.length
          ? aula.professores
          : aula.professor_nome
            ? [{ id: aula.professor_id ?? null, nome: aula.professor_nome }]
            : [],
        room: aula.sala_nome ?? null,
      })),
    [activeGrade],
  )

  const horariosTurmas = useMemo(() => {
    const result: Record<number, string[]> = {}
    for (const [turmaId, horarios] of Object.entries(activeGrade?.horarios_turmas ?? {})) {
      result[Number(turmaId)] = horarios
    }
    return result
  }, [activeGrade])

  const activeGradeId = activeGrade?.id

  const updateLesson = useCallback(
    async (id: number, changes: LessonChanges): Promise<UpdateResult> => {
      try {
        await editarAula(id, {
          dia_semana: changes.day,
          horario: changes.time,
          professor_ids: changes.teacherIds,
          sala_nome: changes.room,
        })
        // Recarrega a grade e os conflitos já com a alteração gravada
        await load(activeGradeId)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: getApiErrorMessage(err, 'Não foi possível salvar a aula.') }
      }
    },
    [load, activeGradeId],
  )

  const applySuggestion = useCallback(
    async (conflictId: string): Promise<UpdateResult> => {
      const conflict = conflicts.find((c) => c.id === conflictId)
      const lesson = lessons.find((l) => l.id === conflict?.aula_id)
      if (!conflict?.correcao || !lesson) return { ok: false, error: 'Conflito sem sugestão disponível.' }
      return updateLesson(lesson.id, {
        day: conflict.correcao.dia_semana,
        time: conflict.correcao.horario,
        teacherIds: lesson.teachers.flatMap((t) => (t.id != null ? [t.id] : [])),
        room: lesson.room,
      })
    },
    [conflicts, lessons, updateLesson],
  )

  const value = useMemo<ScheduleContextValue>(
    () => ({
      lessons,
      conflicts,
      isLoading,
      activeGrade,
      horariosTurmas,
      refreshSchedule,
      updateLesson,
      applySuggestion,
    }),
    [lessons, conflicts, isLoading, activeGrade, horariosTurmas, refreshSchedule, updateLesson, applySuggestion],
  )

  return <ScheduleContext value={value}>{children}</ScheduleContext>
}
