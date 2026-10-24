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
  /** Resultado do gerador (sucesso ou motivo da falha) */
  mensagem?: string
  solver_status?: string
  tempo_resolucao_seg?: number
  tempo_limite_seg?: number
  turmas_processadas?: number
  planejamentos?: PlanejamentoGrade[]
  /** Horários vagos entre duas aulas/planejamentos do professor que o gerador não conseguiu evitar */
  janelas?: JanelaProfessor[]
  avisos?: string[]
  regras_em_conflito?: string[]
}

export interface JanelaProfessor {
  professor: string
  professor_id?: number | null
  dia_semana: string
  horario: string
}

/** "gerando" enquanto o solver roda; depois "sucesso", "inviavel", "tempo_esgotado" ou "erro" */
export type StatusGrade = 'gerando' | 'sucesso' | 'inviavel' | 'tempo_esgotado' | 'erro' | string

export interface GradeResumo {
  id: number
  nome: string
  status: StatusGrade
  ano_semestre?: string
  criado_em?: string
  total_aulas: number
  detalhes?: DetalhesGrade
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
 * Inicia a geração automática (Google OR-Tools CP-SAT) em segundo plano. A grade volta com
 * status "gerando"; acompanhe com `getStatusGrade`.
 */
export async function gerarGrade(nome: string, tempoLimiteSeg: number): Promise<GradeResumo> {
  const { data } = await api.post<GradeResumo>('/grades/gerar-grade', null, {
    params: { nome, tempo_limite_seg: tempoLimiteSeg },
  })
  return data
}

export async function getStatusGrade(gradeId: number): Promise<GradeResumo> {
  const { data } = await api.get<GradeResumo>(`/grades/${gradeId}/status`)
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
