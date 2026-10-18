import { api } from './client'

export interface AulaBackend {
  id?: number
  turma_id: number
  turma_nome: string
  disciplina_nome: string
  disciplina_id?: number | null
  professor_id?: number | null
  professor_nome?: string | null
  sala_nome?: string | null
  dia_semana: string
  horario: string
  ordem: number
}

export interface GradeBackend {
  id?: number
  nome: string
  status: string
  ano_semestre?: string
  criado_em?: string
  total_aulas: number
  detalhes?: Record<string, unknown>
  aulas: AulaBackend[]
}

export interface GradeResumo {
  id: number
  nome: string
  status: string
  ano_semestre?: string
  criado_em?: string
  total_aulas: number
  detalhes?: Record<string, unknown>
}

export interface ResultadoGeracaoGrade {
  sucesso: boolean
  status: string
  mensagem: string
  grade_id?: number | null
  total_aulas: number
  tempo_seg?: number
}

/**
 * Dispara o algoritmo de geração automática de horários no backend (Google OR-Tools CP-SAT).
 * @param nome Nome descritivo da grade a ser gerada (opcional).
 */
export async function gerarGrade(nome?: string): Promise<ResultadoGeracaoGrade> {
  const params = nome ? { nome } : {}
  const { data } = await api.post<ResultadoGeracaoGrade>('/grades/gerar-grade', null, { params })
  return data
}

/**
 * Obtém a grade horária gerada completa com suas respectivas aulas alocadas.
 * Caso nenhum `gradeId` seja fornecido, retorna a grade mais recente.
 * @param gradeId Identificador opcional da grade desejada.
 */
export async function getGrade(gradeId?: number): Promise<GradeBackend> {
  const params = gradeId ? { grade_id: gradeId } : {}
  const { data } = await api.get<GradeBackend>('/grades/', { params })
  return data
}

/**
 * Obtém o histórico com todas as grades salvas no sistema.
 */
export async function getHistoricoGrades(): Promise<GradeResumo[]> {
  const { data } = await api.get<GradeResumo[]>('/grades/historico')
  return data
}
