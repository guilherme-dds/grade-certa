import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getHistoricoGrades, type GradeResumo } from '@/api/grades'
import { getProfessores } from '@/api/professores'
import { getSalas } from '@/api/salas'
import { getTurmas } from '@/api/turmas'
import { useAuth } from '@/auth/useAuth'
import { useProfessorLogado } from '@/auth/useProfessorLogado'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/schedule'
import { paths } from '@/config/paths'
import { useSchedule } from '@/schedule/useSchedule'
import { useWorkflow, type StepState } from '@/schedule/useWorkflow'
import { WeekBoard } from './WeekBoard'

const STATUS_LABEL: Record<string, string> = {
  gerando: 'Em andamento',
  sucesso: 'Concluída',
  inviavel: 'Inviável',
  tempo_esgotado: 'Tempo esgotado',
  erro: 'Erro',
}

const STATUS_BADGE_STYLE: Record<string, string> = {
  sucesso: 'bg-primary-soft text-primary',
  gerando: 'bg-warning-soft text-warning',
  inviavel: 'bg-danger-soft text-danger',
  tempo_esgotado: 'bg-danger-soft text-danger',
  erro: 'bg-danger-soft text-danger',
}

export function DashboardOverview() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { conflicts, activeGrade, lessons, changes, isLoading: scheduleLoading, refreshSchedule } = useSchedule()
  const { professor } = useProfessorLogado()

  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })
  const historicoQuery = useQuery({ queryKey: ['historicoGrades'], queryFn: getHistoricoGrades })
  const turmasQuery = useQuery({ queryKey: ['turmas'], queryFn: getTurmas })
  const salasQuery = useQuery({ queryKey: ['salas'], queryFn: getSalas })

  const professores = professoresQuery.data ?? []
  const turmas = turmasQuery.data ?? []
  const salas = salasQuery.data ?? []
  const historico = historicoQuery.data ?? []

  const ativos = professores.filter((p) => p.ativo)
  const comDisponibilidade = ativos.filter((p) => p.disponibilidade_atualizada_em).length
  const semDisponibilidade = ativos.length - comDisponibilidade

  const ultimaGeracao = historico[0] as GradeResumo | undefined
  const isGerando = ultimaGeracao?.status === 'gerando'
  const isFalha = ultimaGeracao != null && ultimaGeracao.status !== 'gerando' && ultimaGeracao.status !== 'sucesso'

  // Prontidão da escola para gerar: turmas com matriz e docentes com disponibilidade
  const temMatriz = (t: (typeof turmas)[number]) =>
    (t.matriz_curricular || []).some((item) => Number(item.aulas_semanais) > 0)
  const turmasValidas = turmas.filter(temMatriz)
  const turmasSemMatriz = turmas.filter((t) => !temMatriz(t))
  const totalAulasDemandadas = turmasValidas.reduce(
    (acc, t) => acc + (t.matriz_curricular || []).reduce((sub, item) => sub + Number(item.aulas_semanais || 0), 0),
    0,
  )
  const partes = [
    turmas.length ? turmasValidas.length / turmas.length : null,
    ativos.length ? comDisponibilidade / ativos.length : null,
  ].filter((v): v is number => v != null)
  const prontidao = partes.length ? Math.round((partes.reduce((a, b) => a + b, 0) / partes.length) * 100) : 0
  const cadastrosLoading = turmasQuery.isLoading || professoresQuery.isLoading

  const aulasDoProfessor = professor ? lessons.filter((l) => l.teachers.some((t) => t.id === professor.id)) : []
  const ultimaAlteracao = changes[0]
  const firstName = user?.name.split(' ')[0]

  const resumo = scheduleLoading
    ? 'Carregando a grade…'
    : activeGrade
      ? conflicts.length === 0
        ? `A grade ${activeGrade.nome} está sem conflitos.`
        : `A grade ${activeGrade.nome} tem ${conflicts.length} ${conflicts.length === 1 ? 'conflito' : 'conflitos'} para resolver.`
      : 'Nenhuma grade gerada ainda. Confira os cadastros e gere a primeira.'

  return (
    <div className="space-y-4">
      {/* Linha 1: lousa + prontidão */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="relative overflow-hidden rounded-[28px] bg-board p-6 text-white md:p-8">
          {/* Brilho sutil no canto, como reflexo na lousa */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.09),transparent_65%)]"
          />

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
            <div className="flex flex-col">
              {activeGrade?.ano_semestre && (
                <p className="text-[13px] text-white/50">Semestre {activeGrade.ano_semestre}</p>
              )}
              <h1 className="mt-1 font-display text-[34px] leading-[1.05] font-bold tracking-[-0.025em] md:text-[44px]">
                Olá, {firstName}
              </h1>
              <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-white/65">{resumo}</p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link to={paths.geracao} className={buttonStyles({}, 'bg-white text-ink shadow-none hover:bg-white/90')}>
                  Gerar grade
                </Link>
                <Link
                  to={paths.grade}
                  className={buttonStyles({}, 'bg-white/10 text-white shadow-none ring-1 ring-white/15 hover:bg-white/15')}
                >
                  Revisar grade
                </Link>
              </div>
            </div>

            <WeekBoard lessons={lessons} />
          </div>

          <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
            <BoardTile
              label="Aulas na semana"
              value={scheduleLoading ? '…' : lessons.length}
              hint={activeGrade ? activeGrade.nome : 'Sem grade ativa'}
              to={paths.grade}
            />
            <BoardTile
              label="Conflitos"
              value={scheduleLoading ? '…' : conflicts.length}
              hint={conflicts.length ? 'Precisam de ajuste' : 'Tudo certo'}
              tone={conflicts.length ? 'danger' : 'ok'}
              to={paths.conflitos}
            />
            <BoardTile
              label="Última geração"
              value={ultimaGeracao ? (STATUS_LABEL[ultimaGeracao.status] ?? ultimaGeracao.status) : '—'}
              hint={ultimaGeracao ? formatDateTime(ultimaGeracao.criado_em) : 'Nenhuma ainda'}
              tone={isFalha ? 'danger' : isGerando ? 'warn' : 'ok'}
              to={paths.geracao}
              small
            />
          </div>
        </section>

        <WorkflowCard percent={prontidao} loading={cadastrosLoading} conflitos={conflicts.length} />
      </div>

      {/* Avisos de geração */}
      {isGerando && (
        <Notice
          tone="warning"
          title="Geração em andamento"
          text="O solver está distribuindo as aulas. Você pode continuar usando o sistema enquanto isso."
          action={
            <Link to={paths.geracao} className={buttonStyles({ size: 'sm' })}>
              Acompanhar geração
            </Link>
          }
          spinning
        />
      )}
      {isFalha && (
        <Notice
          tone="danger"
          title="A última geração não encontrou uma grade viável"
          text={ultimaGeracao?.detalhes?.mensagem ?? 'Revise as restrições e tente de novo.'}
          action={
            <Link to={paths.geracao} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
              Ver diagnóstico
            </Link>
          }
        />
      )}

      {/* Atalho do professor logado */}
      {professor && (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Icon name="calendarUser" width={22} height={22} />
            </span>
            <div>
              <p className="font-display text-[17px] font-bold">Sua semana, {professor.nome.split(' ')[0]}</p>
              <p className="text-[14px] text-muted">
                {activeGrade
                  ? `${aulasDoProfessor.length} ${aulasDoProfessor.length === 1 ? 'aula' : 'aulas'} na grade ${activeGrade.nome}.`
                  : 'A coordenação ainda não publicou uma grade.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={paths.minhaGrade} className={buttonStyles({ size: 'sm' })}>
              Ver minha grade
            </Link>
            <Link to={paths.professores} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
              Atualizar disponibilidade
            </Link>
          </div>
        </section>
      )}

      {/* Linha 2: execuções + cadastros */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-[18px] font-bold">Gerações recentes</h2>
            <Link to={paths.geracao} className="text-[13px] font-semibold text-muted hover:text-ink">
              Ver histórico
            </Link>
          </div>

          {historicoQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-paper" />
              ))}
            </div>
          ) : historico.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-line p-8 text-center">
              <p className="font-semibold">Nenhuma grade gerada</p>
              <p className="mt-1 text-[14px] text-muted">Gere a primeira grade para vê-la aqui.</p>
              <Link to={paths.geracao} className={buttonStyles({ size: 'sm' }, 'mt-4')}>
                Gerar grade
              </Link>
            </div>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-[14px]">
                <thead>
                  <tr className="text-left text-[12.5px] text-muted">
                    <th scope="col" className="px-2 pb-2 font-medium">Grade</th>
                    <th scope="col" className="px-2 pb-2 font-medium">Gerada em</th>
                    <th scope="col" className="px-2 pb-2 text-right font-medium">Aulas</th>
                    <th scope="col" className="px-2 pb-2 font-medium">Situação</th>
                    <th scope="col" className="px-2 pb-2"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {historico.slice(0, 5).map((g) => (
                    <tr key={g.id} className="border-t border-line-soft">
                      <td className="max-w-[220px] truncate px-2 py-3 font-semibold">{g.nome}</td>
                      <td className="px-2 py-3 whitespace-nowrap text-muted tabular-nums">{formatDateTime(g.criado_em)}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{g.total_aulas}</td>
                      <td className="px-2 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap',
                            STATUS_BADGE_STYLE[g.status] ?? 'bg-paper text-muted',
                          )}
                        >
                          {STATUS_LABEL[g.status] ?? g.status}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right">
                        {g.status === 'sucesso' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await refreshSchedule(g.id)
                              navigate(`${paths.grade}?gradeId=${g.id}`)
                            }}
                            className="rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-ink-soft"
                          >
                            Abrir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ultimaAlteracao && (
            <p className="mt-4 rounded-xl bg-paper px-3.5 py-2.5 text-[13px] text-muted">
              <span className="font-semibold text-ink">Última edição manual:</span> {ultimaAlteracao.descricao}
            </p>
          )}
        </section>

        <section className="card p-5 md:p-6">
          <h2 className="mb-3 font-display text-[18px] font-bold">Cadastros</h2>
          <ul className="flex flex-col gap-1">
            <InventoryRow
              icon="classes"
              title="Turmas"
              detail={`${turmasValidas.length} de ${turmas.length} com matriz`}
              value={turmas.length}
              warn={turmasSemMatriz.length > 0}
              to={paths.turmas}
            />
            <InventoryRow
              icon="teachers"
              title="Professores ativos"
              detail={semDisponibilidade ? `${semDisponibilidade} sem disponibilidade` : 'Disponibilidade em dia'}
              value={ativos.length}
              warn={semDisponibilidade > 0}
              to={semDisponibilidade ? paths.professoresSemDisponibilidade : paths.professores}
            />
            <InventoryRow
              icon="grid"
              title="Salas"
              detail="Cadastradas para alocação"
              value={salas.length}
              to={paths.salas}
            />
            <InventoryRow
              icon="calendar"
              title="Aulas por semana"
              detail="Demanda das matrizes"
              value={totalAulasDemandadas}
              to={paths.turmas}
            />
          </ul>

          {turmasSemMatriz.length > 0 && (
            <p className="mt-3 rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13px] leading-relaxed">
              Sem matriz: {turmasSemMatriz.map((t) => t.nome).join(', ')}.{' '}
              <Link to={paths.turmas} className="font-semibold text-warning underline-offset-2 hover:underline">
                Configurar matrizes
              </Link>
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function BoardTile({
  label,
  value,
  hint,
  to,
  tone = 'ok',
  small,
}: {
  label: string
  value: ReactNode
  hint: string
  to: string
  tone?: 'ok' | 'warn' | 'danger'
  small?: boolean
}) {
  const dot = { ok: 'bg-accent', warn: 'bg-warning', danger: 'bg-[#ff7a5c]' }[tone]
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-[20px] bg-white/[0.06] p-4 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]"
    >
      <span className="flex items-center justify-between text-[13px] text-white/55">
        <span className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', dot)} aria-hidden="true" />
          {label}
        </span>
        <Icon name="arrowUpRight" width={14} height={14} className="text-white/35 group-hover:text-white" />
      </span>
      <span
        className={cn(
          'mt-3 truncate font-display font-bold tracking-[-0.02em] tabular-nums',
          small ? 'text-[22px] leading-[34px]' : 'text-[30px] leading-[34px]',
        )}
      >
        {value}
      </span>
      <span className="mt-0.5 truncate text-[12.5px] text-white/45">{hint}</span>
    </Link>
  )
}

function WorkflowCard({ percent, loading, conflitos }: { percent: number; loading: boolean; conflitos: number }) {
  const { steps, podeGerar } = useWorkflow()
  const r = 54
  const circ = 2 * Math.PI * r
  const value = loading ? 0 : percent

  // O botão leva sempre ao próximo passo pendente
  const next =
    steps.cadastros !== 'done' && !podeGerar
      ? { to: paths.turmas, label: 'Completar cadastros' }
      : steps.geracao !== 'done'
        ? { to: paths.geracao, label: 'Gerar grade' }
        : conflitos > 0
          ? { to: paths.conflitos, label: `Resolver ${conflitos} ${conflitos === 1 ? 'conflito' : 'conflitos'}` }
          : steps.cadastros !== 'done'
            ? { to: paths.professoresSemDisponibilidade, label: 'Completar disponibilidade' }
            : { to: paths.relatorios, label: 'Ver relatórios' }

  const rows: { key: keyof typeof steps; label: string; to: string; hint: Record<StepState, string> }[] = [
    {
      key: 'cadastros',
      label: 'Cadastros',
      to: paths.cadastros,
      hint: { done: 'Completos', current: `${percent}% completos`, todo: '' },
    },
    {
      key: 'geracao',
      label: 'Gerar grade',
      to: paths.geracao,
      hint: { done: 'Grade gerada', current: 'Pronto para gerar', todo: 'Aguardando cadastros' },
    },
    {
      key: 'revisao',
      label: 'Revisar grade',
      to: paths.grade,
      hint: { done: 'Sem conflitos', current: `${conflitos} ${conflitos === 1 ? 'conflito' : 'conflitos'}`, todo: 'Aguardando grade' },
    },
  ]

  return (
    <section className="card flex flex-col p-6">
      <h2 className="font-display text-[18px] font-bold">Montar a grade</h2>
      <p className="text-[13px] text-muted">Cadastros prontos para o gerador</p>

      <div className="relative mx-auto my-5 grid size-[140px] place-items-center">
        <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="64" cy="64" r={r} fill="none" stroke="var(--color-line-soft)" strokeWidth="12" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - value / 100)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <p className="font-display text-[32px] font-bold tracking-[-0.03em] tabular-nums">{loading ? '…' : `${percent}%`}</p>
      </div>

      <ol className="space-y-1">
        {rows.map((row, i) => {
          const state = steps[row.key]
          return (
            <li key={row.key}>
              <Link to={row.to} className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-paper">
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold',
                    state === 'done' && 'bg-accent text-ink',
                    state === 'current' && 'bg-ink text-white',
                    state === 'todo' && 'text-muted ring-1 ring-line',
                  )}
                >
                  {state === 'done' ? <Icon name="check" width={14} height={14} strokeWidth={2.6} /> : i + 1}
                </span>
                <span className="flex-1 text-[14px] font-semibold">{row.label}</span>
                <span
                  className={cn(
                    'text-[12.5px]',
                    state === 'current' && row.key === 'revisao' && conflitos > 0 ? 'font-semibold text-danger' : 'text-muted',
                  )}
                >
                  {row.hint[state]}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>

      <Link to={next.to} className={buttonStyles({}, 'mt-5 w-full')}>
        {next.label}
      </Link>
    </section>
  )
}

function InventoryRow({
  icon,
  title,
  detail,
  value,
  warn,
  to,
}: {
  icon: IconName
  title: string
  detail: string
  value: number
  warn?: boolean
  to: string
}) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-paper">
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-ink text-white">
          <Icon name={icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{title}</span>
          <span className={cn('block truncate text-[12.5px]', warn ? 'text-warning' : 'text-muted')}>{detail}</span>
        </span>
        <span
          className={cn(
            'min-w-11 rounded-full px-2.5 py-1 text-center text-[13px] font-bold tabular-nums',
            warn ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary',
          )}
        >
          {value}
        </span>
      </Link>
    </li>
  )
}

function Notice({
  tone,
  title,
  text,
  action,
  spinning,
}: {
  tone: 'warning' | 'danger'
  title: string
  text: string
  action: ReactNode
  spinning?: boolean
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-[20px] px-5 py-4',
        tone === 'warning' ? 'bg-warning-soft' : 'bg-danger-soft',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full text-white',
            tone === 'warning' ? 'bg-warning' : 'bg-danger',
          )}
        >
          {spinning ? (
            <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
          ) : (
            <Icon name="conflict" width={16} height={16} />
          )}
        </span>
        <div>
          <p className={cn('font-semibold', tone === 'warning' ? 'text-warning' : 'text-danger')}>{title}</p>
          <p className="text-[13.5px] text-ink/75">{text}</p>
        </div>
      </div>
      {action}
    </div>
  )
}
