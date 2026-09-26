// Dados de exemplo do protótipo (Claude Design · GradeCerta.dc.html).
// Ainda não existem endpoints para estes recursos; substituir por chamadas em src/api/
// conforme o backend evoluir.

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
  pendingConflicts: 4,
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

export const timeSlots = ['07:00', '07:50', '08:40', '09:30', '13:30', '14:20'] as const
