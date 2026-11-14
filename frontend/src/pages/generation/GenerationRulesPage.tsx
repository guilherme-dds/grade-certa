import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getProfessores, type ProfessorBackend } from '@/api/professores'
import { getTurmas, professoresDoItem, type TurmaBackend } from '@/api/turmas'
import { Icon } from '@/components/ui/Icon'
import { paths } from '@/config/paths'
import { TabHeader } from '@/layouts/SectionLayout'

// O que o gerador leva em conta, em linguagem de coordenação
const SEMPRE = [
  'Aulas semanais de cada disciplina, conforme a matriz da turma',
  'Disponibilidade de cada professor e horários bloqueados das salas',
  'Aulas dobradas e aulas fixadas em dia ou horário',
  'Quem dá a primeira aula do turno não dá a última no mesmo dia',
  'Turmas sem horário vago no meio do turno',
  'Almoço, limite de aulas e de horas por dia (jornada)',
  '4 horários de planejamento por professor',
]

const SE_POSSIVEL = [
  'Sem janelas na agenda dos professores; um planejamento pode ocupar o intervalo',
  'Planejamento junto com ao menos um colega da mesma área',
]

/** Regras que o gerador respeita e as aulas que a escola prendeu num dia ou horário. */
export function GenerationRulesPage() {
  const { data: turmas = [], isLoading: loadingTurmas } = useQuery<TurmaBackend[]>({
    queryKey: ['turmas'],
    queryFn: () => getTurmas(),
  })
  const { data: professores = [] } = useQuery<ProfessorBackend[]>({
    queryKey: ['professores'],
    queryFn: () => getProfessores(),
  })
  const nomePorId = new Map(professores.flatMap((p) => (p.id ? [[p.id, p.nome] as const] : [])))
  const aulasFixas = turmas.flatMap((t) =>
    (t.matriz_curricular ?? []).filter((item) => item.horarios_fixos?.length).map((item) => ({ turma: t, item })),
  )

  return (
    <>
      <TabHeader
        title="Regras da geração"
        description="O que o gerador garante em toda grade e o que ele tenta alcançar. Nada aqui precisa ser configurado antes de gerar."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="card p-5 md:p-6" aria-labelledby="regras-sempre">
          <h2 id="regras-sempre" className="font-display text-[18px] font-bold">
            Sempre respeitado
          </h2>
          <p className="mt-1 text-[13.5px] text-muted">
            Se uma destas regras não couber, a geração falha e diz o motivo.
          </p>
          <ul className="mt-4 divide-y divide-line-soft">
            {SEMPRE.map((r) => (
              <li key={r} className="flex gap-3 py-2.5 text-[14px]">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Icon name="check" width={14} height={14} strokeWidth={2.6} />
                </span>
                {r}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-4">
          <section className="card p-5 md:p-6" aria-labelledby="regras-possivel">
            <h2 id="regras-possivel" className="font-display text-[18px] font-bold">
              Sempre que possível
            </h2>
            <p className="mt-1 text-[13.5px] text-muted">
              O gerador busca o melhor resultado; o que não der aparece no resultado da geração.
            </p>
            <ul className="mt-4 space-y-2.5">
              {SE_POSSIVEL.map((r) => (
                <li key={r} className="flex gap-3 text-[14px]">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-paper text-muted">
                    <span className="size-1.5 rounded-full bg-current" />
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-1 flex-col justify-between gap-4 rounded-[24px] bg-board p-5 text-white md:p-6">
            <div>
              <h2 className="font-display text-[18px] font-bold">Jornada da escola</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">
                Almoço, máximo de aulas e de horas por dia valem para todos os professores, salvo quem tem jornada
                própria no cadastro.
              </p>
            </div>
            <Link
              to={paths.escola}
              className="self-start rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-ink hover:bg-white/90"
            >
              Ajustar jornada
            </Link>
          </section>
        </div>

        <section className="card p-5 md:p-6 lg:col-span-2" aria-labelledby="aulas-fixas">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="aulas-fixas" className="font-display text-[18px] font-bold">
              Aulas fixadas
            </h2>
            <p className="text-[13px] text-muted">
              Ficam exatamente onde foram fixadas. Para mudar, edite a matriz da turma.
            </p>
          </div>
          {loadingTurmas ? (
            <div className="mt-4 h-24 animate-pulse rounded-2xl bg-paper" />
          ) : aulasFixas.length === 0 ? (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-line px-5 py-6 text-center text-[14px] text-muted">
              Nenhuma aula fixada. Para prender uma aula num dia ou horário (ex.: laboratório), abra a matriz da turma
              em{' '}
              <Link to={paths.turmas} className="font-semibold text-ink hover:underline">
                Cadastros › Turmas
              </Link>
              .
            </p>
          ) : (
            <div className="relative mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[14px]">
                <thead>
                  <tr className="text-[12.5px] text-muted">
                    <th className="py-2 pr-3 font-medium">Turma</th>
                    <th className="py-2 pr-3 font-medium">Disciplina</th>
                    <th className="py-2 pr-3 font-medium">Professores</th>
                    <th className="py-2 pr-3 font-medium">Quando</th>
                    <th className="py-2">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aulasFixas.map(({ turma, item }) => (
                    <tr key={`${turma.id}-${item.disciplina}`} className="border-t border-line-soft">
                      <td className="py-2.5 pr-3 font-semibold">{turma.nome}</td>
                      <td className="py-2.5 pr-3">
                        {item.disciplina}
                        {item.extra && <span className="ml-1.5 text-[12px] text-muted">(extra)</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">
                        {professoresDoItem(item, nomePorId).join(', ') || 'Sem professor'}
                      </td>
                      <td className="py-2.5 pr-3">
                        {item
                          .horarios_fixos!.map((f) => `${f.dia_semana}, ${f.horario ?? 'qualquer horário'}`)
                          .join('; ')}
                      </td>
                      <td className="py-2.5 text-right">
                        <Link to={paths.matrizDaTurma(turma.id!)} className="font-semibold hover:underline">
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
