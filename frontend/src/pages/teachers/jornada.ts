import type { Jornada } from '@/api/configuracoes'

export type JornadaErrors = Partial<Record<keyof Jornada, string>>

/** Resumo em uma linha, para a tabela e para quem segue o padrão */
export function resumoJornada(j: Jornada) {
  const almoco = j.almoco_minutos
    ? `Almoço de ${j.almoco_minutos} min entre ${j.almoco_inicio} e ${j.almoco_fim}`
    : 'Sem exigência de almoço'
  return `${almoco} · até ${j.max_aulas_dia} aulas por dia`
}

export function validarJornada(j: Jornada): JornadaErrors {
  const erros: JornadaErrors = {}
  const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))
  const faixa = minutos(j.almoco_fim) - minutos(j.almoco_inicio)

  if (!j.almoco_inicio) erros.almoco_inicio = 'Informe o início.'
  if (!j.almoco_fim) erros.almoco_fim = 'Informe o fim.'
  else if (faixa <= 0) erros.almoco_fim = 'Precisa ser depois do início.'
  if (j.almoco_minutos < 0 || j.almoco_minutos > 240) erros.almoco_minutos = 'Entre 0 e 240 minutos.'
  else if (faixa > 0 && j.almoco_minutos > faixa) erros.almoco_minutos = 'Não cabe na faixa informada.'
  if (j.max_aulas_dia < 1 || j.max_aulas_dia > 12) erros.max_aulas_dia = 'Entre 1 e 12 aulas.'
  return erros
}
