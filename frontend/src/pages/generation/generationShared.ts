import type { StatusGrade } from '@/api/grades'

export const STATUS_LABEL: Record<string, string> = {
  gerando: 'Gerando',
  cancelando: 'Cancelando',
  sucesso: 'Concluída',
  inviavel: 'Inviável',
  tempo_esgotado: 'Tempo esgotado',
  erro: 'Erro',
}

/** Ainda ocupando o worker: rodando ou parando depois de cancelada */
export const isEmAndamento = (status: StatusGrade) => status === 'gerando' || status === 'cancelando'

/** "cancelada" só existe na tela, depois que a geração cancelada some do servidor */
export const isFalha = (status: StatusGrade) => !isEmAndamento(status) && status !== 'sucesso' && status !== 'cancelada'
