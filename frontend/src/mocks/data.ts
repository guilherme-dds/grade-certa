// Dados de exemplo do protótipo (Claude Design · GradeCerta.dc.html).

export const institution = {
  name: 'Escola Modelo Municipal',
  term: '2º Semestre 2026',
}

export const adminStats = {
  activeInstitutions: 12,
  users: 348,
  schedulesThisMonth: 9,
  openTickets: 3,
}

export type InstitutionStatus = 'ativa' | 'onboarding'

export const recentInstitutions: { name: string; plan: string; status: InstitutionStatus }[] = [
  { name: 'Escola Modelo Municipal', plan: 'Institucional', status: 'ativa' },
  { name: 'Colégio Santa Rita', plan: 'Institucional', status: 'ativa' },
  { name: 'EMEF Jardim das Flores', plan: 'Piloto', status: 'onboarding' },
]

export const coordStats = {
  scheduleStatus: 'Em geração',
  pendingAvailability: 6,
  totalTeachers: 42,
  nextGeneration: '18/09 · 08h00',
}

export const teacherStats = {
  availabilityUpdatedAt: '12/09',
  classesThisWeek: 18,
  scheduleStatus: 'Publicada',
}

export interface Subject {
  name: string
  weeklyHours: number
  teacher: string
  classes: string
}

export const subjects: Subject[] = [
  { name: 'Matemática', weeklyHours: 5, teacher: 'Ana Ferreira', classes: '6ºA, 6ºB' },
  { name: 'Português', weeklyHours: 5, teacher: 'Carlos Lima', classes: '6ºA, 7ºA' },
  { name: 'Ciências', weeklyHours: 3, teacher: 'Beatriz Souza', classes: '7ºA, 7ºB' },
  { name: 'História', weeklyHours: 3, teacher: 'João Prado', classes: '6ºA, 6ºB' },
  { name: 'Educação Física', weeklyHours: 2, teacher: 'Marina Alves', classes: 'Todas' },
]

export interface Room {
  name: string
  capacity: number
  type: string
}

export const rooms: Room[] = [
  { name: 'Sala 101', capacity: 35, type: 'Sala comum' },
  { name: 'Sala 102', capacity: 35, type: 'Sala comum' },
  { name: 'Laboratório de Ciências', capacity: 28, type: 'Laboratório' },
  { name: 'Quadra poliesportiva', capacity: 60, type: 'Educação física' },
]

export const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const

export type NivelEnsinoSchedule = 'Anos Iniciais' | 'Anos Finais' | 'Ensino Médio'

export interface ShiftSchedule {
  manha: readonly string[]
  tarde: readonly string[]
}

export const timeSlotsByNivel: Record<NivelEnsinoSchedule, ShiftSchedule> = {
  'Ensino Médio': {
    manha: [
      '07:20 - 08:10',
      '08:10 - 09:00',
      '09:15 - 10:05',
      '10:05 - 10:55',
      '11:10 - 12:00',
      '12:00 - 12:50',
    ],
    tarde: [
      '13:50 - 14:40',
      '14:40 - 15:30',
      '15:50 - 16:40',
      '16:40 - 17:30',
    ],
  },
  'Anos Finais': {
    manha: [
      '07:20 - 08:10',
      '08:10 - 09:00',
      '09:00 - 09:50',
      '10:10 - 11:00',
      '11:00 - 11:50',
      '11:50 - 12:40',
    ],
    tarde: [
      '13:00 - 13:50',
      '13:50 - 14:40',
      '14:40 - 15:30',
      '15:50 - 16:40',
      '16:40 - 17:30',
      '17:30 - 18:20',
    ],
  },
  'Anos Iniciais': {
    manha: [
      '07:20 - 08:10',
      '08:10 - 09:00',
      '09:20 - 10:10',
      '10:10 - 11:00',
      '11:00 - 11:50',
      '11:50 - 12:40',
    ],
    tarde: [
      '13:00 - 13:50',
      '13:50 - 14:40',
      '14:40 - 15:30',
      '15:50 - 16:40',
      '16:40 - 17:30',
      '17:30 - 18:20',
    ],
  },
}

export function getAllTimeSlotsForNivel(nivel: NivelEnsinoSchedule): string[] {
  const data = timeSlotsByNivel[nivel] ?? timeSlotsByNivel['Anos Finais']
  return [...data.manha, ...data.tarde]
}

// Fallback genérico para componentes estáticos da grade antiga
export const timeSlots = timeSlotsByNivel['Anos Finais'].manha
