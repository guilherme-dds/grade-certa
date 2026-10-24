import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getProfessores } from '@/api/professores'
import { useAuth } from '@/auth/useAuth'
import { SectionHeader } from '@/components/ui/PageHeader'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { formatDateTime } from '@/lib/schedule'
import { useSchedule } from '@/schedule/useSchedule'

export function TeacherDashboard() {
  const { user } = useAuth()
  const { activeGrade, lessons } = useSchedule()
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })

  // O usuário logado é ligado ao cadastro de professor pelo e-mail
  const email = user?.email.trim().toLowerCase()
  const professor = professoresQuery.data?.find((p) => p.email.trim().toLowerCase() === email)

  if (professoresQuery.isSuccess && !professor) {
    return (
      <div className="rounded-lg border border-line bg-white px-6 py-8">
        <p className="text-sm font-semibold">Seu usuário não está vinculado a um professor</p>
        <p className="mt-1 text-[13px] text-muted">
          Peça à coordenação para cadastrar um professor com o e-mail {user?.email}.
        </p>
      </div>
    )
  }

  const minhasAulas = lessons.filter((l) => professor && l.teachers.some((t) => t.id === professor.id))
  const planejamentos = (activeGrade?.detalhes?.planejamentos ?? []).filter(
    (p) => professor && p.professor_id === professor.id,
  )

  return (
    <div className="space-y-6">
      {activeGrade && (
        <Link
          to={`/grade?professor=${encodeURIComponent(professor?.nome ?? '')}`}
          className="block rounded-lg border border-primary-soft-line bg-primary-soft px-4 py-3.5 text-[13.5px] transition-colors hover:border-primary"
        >
          Grade “{activeGrade.nome}” gerada em {formatDateTime(activeGrade.criado_em)} — confira seus horários →
        </Link>
      )}

      <StatGrid>
        <StatCard
          label="Minha disponibilidade"
          value={
            professor?.disponibilidade_atualizada_em
              ? `Atualizada em ${formatDateTime(professor.disponibilidade_atualizada_em)}`
              : 'Não informada'
          }
          tone={professor?.disponibilidade_atualizada_em ? 'default' : 'warning'}
          size="sm"
        />
        <StatCard label="Minhas aulas na semana" value={minhasAulas.length} />
        <StatCard label="Horários de planejamento" value={planejamentos.length} />
      </StatGrid>

      {planejamentos.length > 0 && (
        <section>
          <SectionHeader title="Meus horários de planejamento" />
          <ul className="flex flex-wrap gap-2 text-[13px]">
            {planejamentos.map((p) => (
              <li key={`${p.dia_semana}-${p.horario}`} className="rounded-md border border-line bg-white px-3 py-1.5">
                {p.dia_semana}, {p.horario}
                {p.compartilhado && <span className="ml-1.5 text-xs text-primary">compartilhado</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
