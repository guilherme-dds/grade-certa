export type NivelEnsino = 'Anos Iniciais' | 'Anos Finais' | 'Ensino Médio'

export interface Teacher {
  id: string
  name: string
  email: string
  niveisEnsino: NivelEnsino[]
  subjects: string[]
  maxWeeklyHours: number
  currentWeeklyHours: number
  status: 'ativo' | 'inativo'
}

export const initialTeachers: Teacher[] = [
  {
    id: 'prof-1',
    name: 'Ana Ferreira',
    email: 'ana.ferreira@escola.gov.br',
    niveisEnsino: ['Anos Finais', 'Ensino Médio'],
    subjects: ['Matemática'],
    maxWeeklyHours: 20,
    currentWeeklyHours: 15,
    status: 'ativo',
  },
  {
    id: 'prof-2',
    name: 'Carlos Lima',
    email: 'carlos.lima@escola.gov.br',
    niveisEnsino: ['Ensino Médio'],
    subjects: ['Português'],
    maxWeeklyHours: 20,
    currentWeeklyHours: 18,
    status: 'ativo',
  },
  {
    id: 'prof-3',
    name: 'Beatriz Souza',
    email: 'beatriz.souza@escola.gov.br',
    niveisEnsino: ['Anos Finais'],
    subjects: ['Ciências'],
    maxWeeklyHours: 16,
    currentWeeklyHours: 12,
    status: 'ativo',
  },
  {
    id: 'prof-4',
    name: 'João Prado',
    email: 'joao.prado@escola.gov.br',
    niveisEnsino: ['Anos Finais', 'Ensino Médio'],
    subjects: ['História'],
    maxWeeklyHours: 20,
    currentWeeklyHours: 14,
    status: 'ativo',
  },
  {
    id: 'prof-5',
    name: 'Marina Alves',
    email: 'marina.alves@escola.gov.br',
    niveisEnsino: ['Anos Iniciais', 'Anos Finais'],
    subjects: ['Educação Física'],
    maxWeeklyHours: 12,
    currentWeeklyHours: 10,
    status: 'ativo',
  },
  {
    id: 'prof-6',
    name: 'Roberto Mendes',
    email: 'roberto.mendes@escola.gov.br',
    niveisEnsino: ['Anos Finais'],
    subjects: ['Geografia'],
    maxWeeklyHours: 20,
    currentWeeklyHours: 0,
    status: 'inativo',
  },
]

export const availableSubjectsList = [
  'Matemática',
  'Português',
  'Ciências',
  'História',
  'Geografia',
  'Educação Física',
  'Artes',
  'Inglês',
]
