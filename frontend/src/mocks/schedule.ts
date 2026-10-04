// Grade e conflitos de exemplo (Claude Design · telas 06 e 07).
// Substituir por chamadas à API quando o serviço de geração de grade existir.

import { type timeSlots, type weekDays } from './data'

export type WeekDay = (typeof weekDays)[number]
export type TimeSlot = (typeof timeSlots)[number]
export type SubjectCode = 'MAT' | 'POR' | 'CIE' | 'HIS' | 'EDF'

export const subjectsMeta: Record<SubjectCode, { name: string; color: string }> = {
  MAT: { name: 'Matemática', color: 'bg-primary-soft' },
  POR: { name: 'Português', color: 'bg-warning-soft' },
  CIE: { name: 'Ciências', color: 'bg-lilac-soft' },
  HIS: { name: 'História', color: 'bg-danger-soft' },
  EDF: { name: 'Educação Física', color: 'bg-line-soft' },
}

export const classGroups = ['6ºA', '6ºB', '7ºA'] as const
export type ClassGroup = (typeof classGroups)[number]

export const teachers = ['Ana Ferreira', 'Carlos Lima', 'Beatriz Souza', 'João Prado', 'Marina Alves']

export const roomShortNames: Record<string, string> = {
  'Sala 101': 'S.101',
  'Sala 102': 'S.102',
  'Laboratório de Ciências': 'Lab.',
  'Quadra poliesportiva': 'Quadra',
}

export interface Lesson {
  id: string
  classGroup: ClassGroup
  day: WeekDay
  time: TimeSlot
  subject: SubjectCode
  teacher: string
  room: string
}

export type LessonChanges = Partial<Pick<Lesson, 'day' | 'time' | 'teacher' | 'room'>>

const defaults: Record<SubjectCode, { teacher: string; room: string }> = {
  MAT: { teacher: 'Ana Ferreira', room: 'Sala 101' },
  POR: { teacher: 'Carlos Lima', room: 'Sala 102' },
  CIE: { teacher: 'Beatriz Souza', room: 'Laboratório de Ciências' },
  HIS: { teacher: 'João Prado', room: 'Sala 101' },
  EDF: { teacher: 'Marina Alves', room: 'Quadra poliesportiva' },
}

const classSlug: Record<ClassGroup, string> = { '6ºA': '6a', '6ºB': '6b', '7ºA': '7a' }

function lesson(classGroup: ClassGroup, day: WeekDay, time: TimeSlot, subject: SubjectCode, room?: string): Lesson {
  return {
    id: `${classSlug[classGroup]}-${day.toLowerCase()}-${time.replace(':', '')}`,
    classGroup,
    day,
    time,
    subject,
    teacher: defaults[subject].teacher,
    room: room ?? defaults[subject].room,
  }
}

export const lessons: Lesson[] = [
  // 6ºA — manhã (linhas 07:00–08:40 iguais ao design)
  lesson('6ºA', 'Seg', '07:00', 'MAT'),
  lesson('6ºA', 'Seg', '07:50', 'POR'),
  lesson('6ºA', 'Seg', '08:40', 'CIE'),
  lesson('6ºA', 'Seg', '09:30', 'HIS'),
  lesson('6ºA', 'Ter', '07:00', 'POR'),
  lesson('6ºA', 'Ter', '07:50', 'MAT'),
  lesson('6ºA', 'Ter', '08:40', 'HIS'),
  lesson('6ºA', 'Ter', '09:30', 'CIE'),
  lesson('6ºA', 'Qua', '07:00', 'MAT'),
  lesson('6ºA', 'Qua', '07:50', 'HIS'),
  lesson('6ºA', 'Qua', '08:40', 'POR'),
  lesson('6ºA', 'Qua', '09:30', 'EDF'),
  lesson('6ºA', 'Qui', '07:00', 'CIE'),
  lesson('6ºA', 'Qui', '07:50', 'MAT'),
  lesson('6ºA', 'Qui', '08:40', 'HIS'),
  lesson('6ºA', 'Qui', '09:30', 'POR'),
  lesson('6ºA', 'Sex', '07:00', 'POR'),
  lesson('6ºA', 'Sex', '07:50', 'EDF'),
  lesson('6ºA', 'Sex', '08:40', 'MAT'),

  // 6ºB — majoritariamente tarde
  lesson('6ºB', 'Seg', '13:30', 'MAT'),
  lesson('6ºB', 'Seg', '14:20', 'HIS'),
  lesson('6ºB', 'Ter', '09:30', 'POR', 'Sala 101'),
  lesson('6ºB', 'Ter', '13:30', 'CIE'),
  lesson('6ºB', 'Ter', '14:20', 'MAT'),
  lesson('6ºB', 'Qua', '13:30', 'POR'),
  lesson('6ºB', 'Qua', '14:20', 'EDF'),
  lesson('6ºB', 'Qui', '13:30', 'CIE'),
  lesson('6ºB', 'Qui', '14:20', 'POR'),
  lesson('6ºB', 'Sex', '09:30', 'HIS'),
  lesson('6ºB', 'Sex', '13:30', 'MAT'),

  // 7ºA
  lesson('7ºA', 'Seg', '13:30', 'CIE'),
  lesson('7ºA', 'Ter', '09:30', 'POR'),
  lesson('7ºA', 'Ter', '14:20', 'HIS', 'Sala 102'),
  lesson('7ºA', 'Qua', '13:30', 'MAT'),
  lesson('7ºA', 'Qua', '14:20', 'POR'),
  lesson('7ºA', 'Qui', '13:30', 'MAT', 'Laboratório de Ciências'),
  lesson('7ºA', 'Sex', '13:30', 'HIS', 'Sala 102'),
  lesson('7ºA', 'Sex', '14:20', 'MAT'),
]

export type ConflictSeverity = 'alto' | 'medio'

export interface Conflict {
  id: string
  severity: ConflictSeverity
  kind: string
  description: string
  suggestion: string
  /** Aula que a sugestão automática altera */
  lessonId: string
  fix: LessonChanges
}

export const conflicts: Conflict[] = [
  {
    id: 'c1',
    severity: 'alto',
    kind: 'Professor duplicado',
    description: 'Carlos Lima alocado em Sala 101 (6ºB) e Sala 102 (7ºA) simultaneamente (Ter, 09:30).',
    suggestion: 'Mover Português (7ºA) para Ter, 13:30.',
    lessonId: '7a-ter-0930',
    fix: { time: '13:30' },
  },
  {
    id: 'c2',
    severity: 'alto',
    kind: 'Descanso insuficiente',
    description:
      'Beatriz Souza tem apenas 10 min entre o turno da manhã e da tarde na Seg (mínimo: 15 min).',
    suggestion: 'Adiar Ciências (7ºA) de 13:30 para 14:20.',
    lessonId: '7a-seg-1330',
    fix: { time: '14:20' },
  },
  {
    id: 'c3',
    severity: 'medio',
    kind: 'Sala ocupada',
    description: 'Laboratório de Ciências reservado para 6ºB e 7ºA na Qui, 13:30.',
    suggestion: 'Realocar Matemática (7ºA) para a Sala 102.',
    lessonId: '7a-qui-1330',
    fix: { room: 'Sala 102' },
  },
  {
    id: 'c4',
    severity: 'medio',
    kind: 'Limite de aulas consecutivas',
    description: 'João Prado com 5 aulas seguidas na Sex (limite: 4).',
    suggestion: 'Mover História (6ºB) de 09:30 para 14:20.',
    lessonId: '6b-sex-0930',
    fix: { time: '14:20' },
  },
]

/** "Ana Ferreira" → "Ana F." */
export function shortTeacherName(name: string) {
  const [first, ...rest] = name.split(' ')
  const last = rest.at(-1)
  return last ? `${first} ${last[0]}.` : first
}
