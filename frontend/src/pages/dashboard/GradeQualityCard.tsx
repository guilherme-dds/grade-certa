import { Link } from 'react-router'
import type { GradeBackend } from '@/api/grades'
import type { DisponibilidadeItem, ProfessorBackend } from '@/api/professores'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { paths } from '@/config/paths'
import { cn } from '@/lib/cn'
import { useDisponibilidades } from '@/lib/fixosIndisponiveis'
import type { Lesson } from '@/schedule/ScheduleContext'
import { cargaPorProfessor, percentual } from '../reports/reportMetrics'

interface GradeQualityCardProps {
  grade: GradeBackend | null
  lessons: Lesson[]
  professores: ProfessorBackend[]
  loading: boolean
}

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.trim().split(':').map(Number)
  return h * 60 + (m || 0)
}

/** A aula cai (ao menos em parte) no intervalo marcado? */
function sobrepoe(aula: Lesson, marcado: DisponibilidadeItem) {
  if (aula.day !== marcado.dia_semana) return false
  const [inicio, fim] = aula.time.split('-').map(minutos)
  return inicio < minutos(marcado.horario_fim) && minutos(marcado.horario_inicio) < fim
}

/** Quanto a grade exibida é boa, além de válida: janelas, planejamento junto e preferências. */
export function GradeQualityCard({ grade, lessons, professores, loading }: GradeQualityCardProps) {
  // Só quem registrou disponibilidade pode ter horário preferencial
  const comDisponibilidade = professores.filter((p) => p.ativo && p.disponibilidade_atualizada_em && p.id != null)
  const disponibilidades = useDisponibilidades(comDisponibilidade.map((p) => p.id!))

  if (!grade) {
    return (
      <section className="card flex flex-col p-6">
        <h2 className="font-display text-[18px] font-bold">Qualidade da grade</h2>
        <p className="mt-1 text-[13.5px] text-muted">
          {loading ? 'Carregando a grade…' : 'Gere uma grade para ver as janelas, o planejamento e as preferências.'}
        </p>
        {!loading && (
          <Link to={paths.geracao} className={buttonStyles({}, 'mt-5 w-full')}>
            Gerar grade
          </Link>
        )}
      </section>
    )
  }

  const planejamentos = grade.detalhes?.planejamentos ?? []
  const janelas = grade.detalhes?.janelas ?? []
  const compartilhados = planejamentos.filter((p) => p.compartilhado).length
  const cargas = cargaPorProfessor(lessons, planejamentos, janelas, professores)
  const semJanela = percentual(cargas.filter((c) => c.janelas === 0).length, cargas.length)

  // Cada horário marcado como preferencial conta como atendido se o professor tem aula nele
  let preferencias = 0
  let atendidas = 0
  for (const [id, marcados] of disponibilidades) {
    const aulas = lessons.filter((l) => l.teachers.some((t) => t.id === id))
    for (const marcado of marcados.filter((m) => m.tipo === 'preferencial')) {
      preferencias += 1
      if (aulas.some((a) => sobrepoe(a, marcado))) atendidas += 1
    }
  }

  const linhas: { label: string; valor: string; detalhe: string; atencao: boolean; to: string }[] = [
    {
      label: 'Janelas de professor',
      valor: String(janelas.length),
      detalhe: janelas.length === 0 ? 'Ninguém fica com horário vago entre aulas' : 'Horários vagos entre duas aulas',
      atencao: janelas.length > 0,
      to: paths.gradeProfessores,
    },
    {
      label: 'Planejamento compartilhado',
      valor: planejamentos.length ? `${compartilhados} de ${planejamentos.length}` : '—',
      detalhe: 'Junto com um colega da mesma área',
      atencao: false,
      to: paths.gradeProfessores,
    },
    {
      label: 'Preferências atendidas',
      valor: preferencias ? `${atendidas} de ${preferencias}` : '—',
      detalhe: preferencias ? 'Horários preferenciais com aula' : 'Nenhum horário preferencial registrado',
      atencao: preferencias > 0 && atendidas < preferencias,
      to: preferencias ? paths.gradeProfessores : paths.professores,
    },
    {
      label: 'Professores sem janela',
      valor: cargas.length ? `${semJanela}%` : '—',
      detalhe: `${cargas.filter((c) => c.janelas === 0).length} de ${cargas.length} professores`,
      atencao: semJanela < 100,
      to: paths.resumo,
    },
  ]

  return (
    <section className="card flex flex-col p-6">
      <h2 className="font-display text-[18px] font-bold">Qualidade da grade</h2>
      <p className="truncate text-[13px] text-muted" title={grade.nome}>
        {grade.nome}
      </p>

      <ul className="mt-4 space-y-1">
        {linhas.map((linha) => (
          <li key={linha.label}>
            <Link
              to={linha.to}
              className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-paper"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{linha.label}</span>
                <span className="block truncate text-[12.5px] text-muted">{linha.detalhe}</span>
              </span>
              <span
                className={cn(
                  'shrink-0 font-display text-[18px] font-bold tabular-nums',
                  linha.atencao && 'text-warning',
                )}
              >
                {linha.valor}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link to={paths.resumo} className={buttonStyles({ variant: 'secondary' }, 'mt-4 w-full')}>
        Ver resumo da grade
      </Link>
    </section>
  )
}
