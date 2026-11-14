import type { StatusGrade } from '@/api/grades'

export const STATUS_LABEL: Record<string, string> = {
  gerando: 'Gerando',
  sucesso: 'Concluída',
  inviavel: 'Inviável',
  tempo_esgotado: 'Tempo esgotado',
  erro: 'Erro',
}

export const isFalha = (status: StatusGrade) => status !== 'gerando' && status !== 'sucesso'
