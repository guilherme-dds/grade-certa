import type { ProfessorBackend } from '@/api/professores'
import type { NivelEnsino } from '@/lib/schedule'

export type { NivelEnsino }

/** Professor do core-service no formato usado pelas telas de professores */
export interface Teacher {
  id: string
  name: string
  email: string
  niveisEnsino: NivelEnsino[]
  subjects: string[]
  maxWeeklyHours: number
  /** Soma das aulas semanais atribuídas ao professor nas matrizes curriculares das turmas */
  currentWeeklyHours: number
  status: 'ativo' | 'inativo'
}

export type TeacherRow = Teacher & { raw: ProfessorBackend }
