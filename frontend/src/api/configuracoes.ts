import { api } from './client'

/** Almoço e limite diário: padrão da escola ou personalização de um professor */
export interface Jornada {
  /** O professor precisa ter `almoco_minutos` seguidos livres dentro desta faixa */
  almoco_inicio: string
  almoco_fim: string
  /** 0 = sem exigência de almoço */
  almoco_minutos: number
  max_aulas_dia: number
}

export async function getJornadaPadrao(): Promise<Jornada> {
  const { data } = await api.get<Jornada>('/configuracoes/jornada')
  return data
}

export async function saveJornadaPadrao(jornada: Jornada): Promise<Jornada> {
  const { data } = await api.put<Jornada>('/configuracoes/jornada', jornada)
  return data
}
