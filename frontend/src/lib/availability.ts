import type { HorariosEscola } from '@/api/grades'
import type { DisponibilidadeItem } from '@/api/professores'
import { splitHorario, type NivelEnsino } from '@/lib/schedule'

export type SlotState = 'disponivel' | 'preferencial' | 'indisponivel'
export type AvailabilitySlots = Record<string, SlotState>

export const slotKey = (nivel: string, day: string, time: string) => `${nivel}__${day}__${time}`

function overlaps(a: string, b: string) {
  const [ia, fa] = splitHorario(a)
  const [ib, fb] = splitHorario(b)
  return ia < fb && ib < fa
}

/** Converte os horários salvos no backend para o estado das células (o padrão é disponível). */
export function itemsToSlots(
  items: DisponibilidadeItem[],
  niveis: readonly NivelEnsino[],
  horarios: HorariosEscola,
): AvailabilitySlots {
  const slots: AvailabilitySlots = {}
  for (const item of items) {
    const marcado = `${item.horario_inicio} - ${item.horario_fim}`
    for (const nivel of niveis) {
      if (item.nivel_ensino && item.nivel_ensino !== nivel) continue
      const grade = horarios.niveis[nivel]
      for (const time of grade ? [...grade.manha, ...grade.tarde] : []) {
        // Registro sem nível (legado) marca todo horário que se sobrepõe a ele
        if (item.nivel_ensino ? time === marcado : overlaps(time, marcado)) {
          slots[slotKey(nivel, item.dia_semana, time)] = item.tipo
        }
      }
    }
  }
  return slots
}

/** Só os horários indisponíveis e preferenciais são enviados; o restante fica disponível. */
export function slotsToItems(slots: AvailabilitySlots): DisponibilidadeItem[] {
  return Object.entries(slots)
    .filter(([, state]) => state !== 'disponivel')
    .map(([key, state]) => {
      const [nivel, dia, time] = key.split('__')
      const [inicio, fim] = splitHorario(time)
      return {
        dia_semana: dia,
        horario_inicio: inicio,
        horario_fim: fim,
        tipo: state as Exclude<SlotState, 'disponivel'>,
        nivel_ensino: nivel,
      }
    })
}
