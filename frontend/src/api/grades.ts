import { api } from './client'

export interface AulaBackend {
  id?: number
  turma_id: number
  turma_nome: string
  disciplina_nome: string
  disciplina_id?: number | null
  /** Primeiro professor da aula (formato antigo) */
  professor_id?: number | null
  professor_nome?: string | null
  /** Todos os professores da aula (mais de um = aula dada em conjunto) */
  professores?: ProfessorAula[]
  sala_nome?: string | null
  dia_semana: string
  horario: string
  ordem: number
}

export interface ProfessorAula {
  id: number | null
  nome: string
}

export interface GradeBackend {
  id?: number
  nome: string
  status: string
  ano_semestre?: string
  criado_em?: string
  total_aulas: number
  detalhes?: DetalhesGrade
  aulas: AulaBackend[]
  /** Horários de cada turma da grade (turma_id -> horários) */
  horarios_turmas?: Record<string, string[]>
}

export interface PlanejamentoGrade {
  professor: string
  professor_id?: number | null
  dia_semana: string
  horario: string
  compartilhado: boolean
}

export interface DetalhesGrade {
  solver_status?: string
  tempo_resolucao_seg?: number
  turmas_processadas?: number
  planejamentos?: PlanejamentoGrade[]
  avisos?: string[]
}

export interface GradeResumo {
  id: number
  nome: string
  status: string
  ano_semestre?: string
  criado_em?: string
  total_aulas: number
  detalhes?: DetalhesGrade
}

export interface ResultadoGeracaoGrade {
  sucesso: boolean
  status: string
  mensagem: string
  grade_id?: number | null
  total_aulas: number
  tempo_seg?: number
  planejamentos_compartilhados?: string
  avisos?: string[]
}

export type GravidadeConflito = 'alto' | 'medio'

export interface ConflitoGrade {
  id: string
  gravidade: GravidadeConflito
  tipo: string
  descricao: string
  aula_id: number
  turma_nome: string
  /** Texto da sugestão; nulo quando não há horário livre para a aula */
  sugestao: string | null
  correcao: { dia_semana: string; horario: string } | null
}

export interface AulaUpdate {
  dia_semana: string
  horario: string
  professor_ids: number[]
  sala_nome: string | null
}

export interface HorariosEscola {
  dias: string[]
  niveis: Record<string, { manha: string[]; tarde: string[] }>
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

/** Dias letivos e horários de aula de cada nível de ensino (manhã/tarde). */
export async function getHorarios(): Promise<HorariosEscola> {
  const { data } = await api.get<HorariosEscola>('/grades/horarios')
  return data
}

/** Conflitos da grade (choques e indisponibilidades) com sugestão de horário livre. */
export async function getConflitos(gradeId: number): Promise<ConflitoGrade[]> {
  const { data } = await api.get<ConflitoGrade[]>(`/grades/${gradeId}/conflitos`)
  return data
}

/** Reatribui dia, horário, professor e sala de uma aula (recusa choque na mesma turma). */
export async function editarAula(aulaId: number, payload: AulaUpdate): Promise<AulaBackend> {
  const { data } = await api.put<AulaBackend>(`/grades/aulas/${aulaId}`, payload)
  return data
}
