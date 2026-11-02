import { api } from './client'

export interface ItemMatriz {
  disciplina: string
  aulas_semanais: number
  /** Ids dos professores que dão a aula juntos (ou em rodízio); o gerador reserva todos no horário */
  professor_ids?: number[]
  /** Nomes de professores ainda sem cadastro (ao salvar, o backend troca nomes cadastrados pelo id) */
  professores?: string[]
  /** Formato antigo, com um professor só (o backend mantém igual ao primeiro de `professores`) */
  professor?: string | null
  /** Dias (e horários) definidos pela escola; as demais aulas o gerador distribui */
  horarios_fixos?: HorarioFixo[]
  /** Aula extra (ex.: laboratório): ocupa horário na grade, mas não entra no total da matriz */
  extra?: boolean
}

export interface HorarioFixo {
  dia_semana: string
  /** Nulo = qualquer horário daquele dia (o gerador escolhe) */
  horario: string | null
}

/** Nomes dos professores sem cadastro, aceitando matrizes salvas no formato antigo */
export function nomesSemCadastro(item: ItemMatriz): string[] {
  if (item.professores?.length) return item.professores
  return item.professor ? [item.professor] : []
}

/** Nomes de todos os professores do item: os cadastrados (pelo id) e os ainda sem cadastro */
export function professoresDoItem(item: ItemMatriz, nomePorId: Map<number, string>): string[] {
  const cadastrados = (item.professor_ids ?? []).flatMap((id) => {
    const nome = nomePorId.get(id)
    return nome ? [nome] : []
  })
  return [...cadastrados, ...nomesSemCadastro(item)]
}

export interface TurmaBackend {
  id?: number
  nome: string
  turno: string
  /** Define os horários de aula da turma (cada nível tem sua grade de horários) */
  nivel_ensino?: string | null
  matriz_curricular?: ItemMatriz[]
  sala_id?: number | null
  /** Turno "Manhã + tardes": dias com aula à tarde (vazio = o gerador escolhe) */
  tardes?: string[]
}

export async function getTurmas(): Promise<TurmaBackend[]> {
  const { data } = await api.get<TurmaBackend[]>('/turmas/')
  return data
}

export async function createTurma(payload: Omit<TurmaBackend, 'id'>): Promise<TurmaBackend> {
  const { data } = await api.post<TurmaBackend>('/turmas/', payload)
  return data
}

export async function updateTurma(id: number, payload: TurmaBackend): Promise<TurmaBackend> {
  const { data } = await api.put<TurmaBackend>(`/turmas/${id}`, payload)
  return data
}

export async function deleteTurma(id: number): Promise<void> {
  await api.delete(`/turmas/${id}`)
}
