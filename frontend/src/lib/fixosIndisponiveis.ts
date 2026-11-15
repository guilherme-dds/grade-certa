import { useQueries } from '@tanstack/react-query'
import { getDisponibilidadeProfessor, type DisponibilidadeItem } from '@/api/professores'
import type { HorarioFixo } from '@/api/turmas'

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.trim().split(':').map(Number)
  return h * 60 + (m || 0)
}

/** "07:20 - 08:10" cai (ao menos em parte) num intervalo marcado como indisponível? */
function sobrepoe(horario: string, marcado: DisponibilidadeItem) {
  const [inicio, fim] = horario.split('-').map(minutos)
  return inicio < minutos(marcado.horario_fim) && minutos(marcado.horario_inicio) < fim
}

/**
 * O professor está indisponível neste fixo? Com horário, basta ele estar marcado como indisponível nele;
 * só com o dia, quando todos os horários da turma naquele dia estão bloqueados.
 */
export function fixoIndisponivel(fixo: HorarioFixo, slots: string[], marcados: DisponibilidadeItem[]) {
  const bloqueado = (horario: string) =>
    marcados.some((m) => m.tipo === 'indisponivel' && m.dia_semana === fixo.dia_semana && sobrepoe(horario, m))
  if (fixo.horario) return bloqueado(fixo.horario)
  return slots.length > 0 && slots.every(bloqueado)
}

/** Disponibilidade de vários professores de uma vez (mesmo cache da tela de disponibilidade) */
export function useDisponibilidades(ids: number[]): Map<number, DisponibilidadeItem[]> {
  const unicos = [...new Set(ids)].sort((a, b) => a - b)
  const consultas = useQueries({
    queries: unicos.map((id) => ({
      queryKey: ['disponibilidade', id],
      queryFn: () => getDisponibilidadeProfessor(id),
      staleTime: 30_000,
    })),
  })
  const mapa = new Map<number, DisponibilidadeItem[]>()
  unicos.forEach((id, i) => {
    const data = consultas[i]?.data
    if (data) mapa.set(id, data)
  })
  return mapa
}
