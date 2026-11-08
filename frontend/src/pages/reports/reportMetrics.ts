// Indicadores dos relatórios, calculados no front a partir da grade e dos cadastros
import type { JanelaProfessor, PlanejamentoGrade } from '@/api/grades'
import type { ProfessorBackend } from '@/api/professores'
import type { IndisponibilidadeSala, SalaBackend } from '@/api/salas'
import { splitHorario, weekDays } from '@/lib/schedule'
import type { Lesson } from '@/schedule/ScheduleContext'

const compararNomes = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true })

/** Nomes distintos em ordem alfabética, com "6º Ano B" antes de "10º Ano A" */
export function nomesOrdenados(nomes: Iterable<string>) {
  return Array.from(new Set(nomes)).sort(compararNomes)
}

export interface CargaProfessor {
  nome: string
  aulas: number
  /** Nula quando o professor da matriz não está no cadastro */
  cargaMaxima: number | null
  planejamentos: number
  janelas: number
}

/** Aulas de cada professor, da maior carga para a menor. Em aula conjunta, a aula conta para todos. */
export function cargaPorProfessor(
  lessons: Lesson[],
  planejamentos: PlanejamentoGrade[],
  janelas: JanelaProfessor[],
  cadastro: ProfessorBackend[],
): CargaProfessor[] {
  const professores = new Map<string, { id: number | null; aulas: number }>()
  for (const plano of planejamentos) {
    professores.set(plano.professor, { id: plano.professor_id ?? null, aulas: 0 })
  }
  for (const professor of lessons.flatMap((l) => l.teachers)) {
    const atual = professores.get(professor.nome)
    professores.set(professor.nome, { id: professor.id ?? atual?.id ?? null, aulas: (atual?.aulas ?? 0) + 1 })
  }

  return Array.from(professores, ([nome, { id, aulas }]) => {
    const registro = cadastro.find(
      (p) => p.id === id || p.nome.trim().toLowerCase() === nome.trim().toLowerCase(),
    )
    return {
      nome,
      aulas,
      cargaMaxima: registro?.carga_maxima_aulas || null,
      planejamentos: planejamentos.filter((p) => p.professor === nome).length,
      janelas: janelas.filter((j) => j.professor === nome).length,
    }
  }).sort((a, b) => b.aulas - a.aulas || compararNomes(a.nome, b.nome))
}

type Intervalo = [inicio: number, fim: number]

function minutos(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function intervaloDoHorario(horario: string): Intervalo {
  const [inicio, fim] = splitHorario(horario)
  return [minutos(inicio), minutos(fim)]
}

function intervaloDoBloqueio(bloqueio: IndisponibilidadeSala): Intervalo {
  return [minutos(bloqueio.horario_inicio), minutos(bloqueio.horario_fim)]
}

/** Junta intervalos sobrepostos: cada nível de ensino tem seus horários (ex.: 09:00 e 09:15) */
function unir(intervalos: Intervalo[]) {
  const unidos: Intervalo[] = []
  for (const [inicio, fim] of [...intervalos].sort((a, b) => a[0] - b[0])) {
    const ultimo = unidos.at(-1)
    if (ultimo && inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fim)
    else unidos.push([inicio, fim])
  }
  return unidos
}

function subtrair(intervalos: Intervalo[], removidos: Intervalo[]) {
  return removidos.reduce<Intervalo[]>(
    (restantes, [inicio, fim]) =>
      restantes.flatMap(([a, b]): Intervalo[] => {
        if (fim <= a || inicio >= b) return [[a, b]]
        const partes: Intervalo[] = []
        if (inicio > a) partes.push([a, inicio])
        if (fim < b) partes.push([fim, b])
        return partes
      }),
    intervalos,
  )
}

const duracao = (intervalos: Intervalo[]) => intervalos.reduce((total, [inicio, fim]) => total + fim - inicio, 0)

/** O horário encosta no bloqueio da sala? */
export function horarioBloqueado(horario: string, bloqueio: IndisponibilidadeSala) {
  const [inicio, fim] = intervaloDoHorario(horario)
  const [bloqueioInicio, bloqueioFim] = intervaloDoBloqueio(bloqueio)
  return inicio < bloqueioFim && fim > bloqueioInicio
}

export interface OcupacaoSala {
  nome: string
  /** Nulos quando a sala da grade não existe mais no cadastro */
  capacidade: number | null
  tipo: string | null
  indisponibilidades: IndisponibilidadeSala[]
  aulas: Lesson[]
  minutosOcupados: number
  minutosDisponiveis: number
}

/**
 * Ocupação das salas cadastradas e das que só aparecem na grade. O tempo disponível é a união dos
 * horários das turmas nos 5 dias, menos os bloqueios da sala.
 */
export function ocupacaoSalas(
  salas: SalaBackend[],
  lessons: Lesson[],
  horariosTurmas: Record<number, string[]>,
): OcupacaoSala[] {
  const horariosDaGrade = unir(
    [...Object.values(horariosTurmas).flat(), ...lessons.map((l) => l.time)].map(intervaloDoHorario),
  )
  const nomes = nomesOrdenados([
    ...salas.map((s) => s.nome),
    ...lessons.flatMap((l) => (l.room ? [l.room] : [])),
  ])

  return nomes.map((nome) => {
    const sala = salas.find((s) => s.nome === nome)
    const indisponibilidades = sala?.indisponibilidades ?? []
    const aulas = lessons.filter((l) => l.room === nome)
    let minutosOcupados = 0
    let minutosDisponiveis = 0

    for (const dia of weekDays) {
      const bloqueios = indisponibilidades.filter((i) => i.dia_semana === dia).map(intervaloDoBloqueio)
      const ocupados = unir(aulas.filter((a) => a.day === dia).map((a) => intervaloDoHorario(a.time)))
      minutosOcupados += duracao(subtrair(ocupados, bloqueios))
      minutosDisponiveis += duracao(subtrair(horariosDaGrade, bloqueios))
    }

    return {
      nome,
      capacidade: sala?.capacidade ?? null,
      tipo: sala?.tipo ?? null,
      indisponibilidades,
      aulas,
      minutosOcupados,
      minutosDisponiveis,
    }
  })
}

/** Percentual inteiro; sem base de cálculo, retorna 0 */
export function percentual(parte: number, total: number) {
  return total > 0 ? Math.round((parte / total) * 100) : 0
}

/** Horários com aula na sala ou bloqueados em algum dia, na ordem do dia */
export function horariosDaSala(ocupacao: OcupacaoSala, horariosTurmas: Record<number, string[]>) {
  const comAula = ocupacao.aulas.map((a) => a.time)
  const bloqueados = Object.values(horariosTurmas)
    .flat()
    .filter((h) => ocupacao.indisponibilidades.some((i) => horarioBloqueado(h, i)))
  return Array.from(new Set([...comAula, ...bloqueados])).sort()
}
