import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getHistoricoGrades, type GradeResumo } from '@/api/grades'
import { getProfessores } from '@/api/professores'
import { getSalas } from '@/api/salas'
import { getTurmas, type TurmaBackend } from '@/api/turmas'
import { useAuth } from '@/auth/useAuth'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { formatDateTime, weekDays } from '@/lib/schedule'
import type { Lesson } from '@/schedule/ScheduleContext'
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

export function DashboardOverview() {
  const { user } = useAuth()
  const { conflicts, activeGrade, lessons, changes, isLoading: scheduleLoading } = useSchedule()

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

  const ultimaAlteracao = changes[0]
  const firstName = user?.name.split(' ')[0]

  // Tudo o que precisa de atenção, do mais grave ao mais leve, cada item com o caminho para resolver
  const nomes = (lista: { nome: string }[]) =>
    lista
      .slice(0, 4)
      .map((x) => x.nome)
      .join(', ') + (lista.length > 4 ? ` e mais ${lista.length - 4}` : '')
  const aulasSemProfessor = turmas.flatMap((t) =>
    (t.matriz_curricular ?? [])
      .filter((i) => Number(i.aulas_semanais) > 0 && !i.professor_ids?.length && !i.professores?.length)
      .map((i) => ({ nome: `${i.disciplina} (${t.nome})` })),
  )
  const cargaPorProfessor = new Map<number, number>()
  for (const t of turmas)
    for (const i of t.matriz_curricular ?? [])
      for (const id of i.professor_ids ?? [])
        cargaPorProfessor.set(id, (cargaPorProfessor.get(id) ?? 0) + Number(i.aulas_semanais || 0))
  const acimaDaCarga = ativos.filter((p) => p.id != null && (cargaPorProfessor.get(p.id) ?? 0) > p.carga_maxima_aulas)
  const pendencias = [
    conflicts.length > 0 && {
      tone: 'danger' as const,
      count: conflicts.length,
      title: conflicts.length === 1 ? 'Conflito na grade' : 'Conflitos na grade',
      detail: 'Aulas em choque depois de edições manuais',
      action: 'Resolver',
      to: paths.conflitos,
    },
    turmasSemMatriz.length > 0 && {
      tone: 'danger' as const,
      count: turmasSemMatriz.length,
      title: turmasSemMatriz.length === 1 ? 'Turma sem matriz curricular' : 'Turmas sem matriz curricular',
      detail: `${nomes(turmasSemMatriz)}: ficam de fora da grade`,
      action: 'Montar matriz',
      to: paths.turmas,
    },
    aulasSemProfessor.length > 0 && {
      tone: 'danger' as const,
      count: aulasSemProfessor.length,
      title: aulasSemProfessor.length === 1 ? 'Disciplina sem professor' : 'Disciplinas sem professor',
      detail: nomes(aulasSemProfessor),
      action: 'Ver disciplinas',
      to: paths.disciplinas,
    },
    acimaDaCarga.length > 0 && {
      tone: 'warning' as const,
      count: acimaDaCarga.length,
      title: acimaDaCarga.length === 1 ? 'Professor acima da carga máxima' : 'Professores acima da carga máxima',
      detail: nomes(acimaDaCarga),
      action: 'Ver professores',
      to: `${paths.professores}?filtro=acima-da-carga`,
    },
    semDisponibilidade > 0 && {
      tone: 'warning' as const,
      count: semDisponibilidade,
      title: 'Sem disponibilidade registrada',
      detail: 'Até registrar, o gerador considera a semana toda livre',
      action: 'Registrar',
      to: paths.professoresSemDisponibilidade,
    },
  ].filter((p) => p !== false)

  const resumo = scheduleLoading
    ? 'Carregando a grade…'
    : activeGrade
      ? conflicts.length === 0
        ? `A grade ${activeGrade.nome} está sem conflitos.`
        : `A grade ${activeGrade.nome} tem ${conflicts.length} ${conflicts.length === 1 ? 'conflito' : 'conflitos'} para resolver.`
      : 'Nenhuma grade gerada ainda. Confira os cadastros e gere a primeira.'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:min-h-[calc(100svh-9.5rem)] xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* Coluna principal: lousa, avisos, pendências e turmas */}
      <div className="flex min-w-0 flex-col gap-4">
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
                <Link
                  to={paths.geracao}
                  className={buttonStyles({}, 'bg-white text-ink shadow-none hover:bg-white/90')}
                >
                  Gerar grade
                </Link>
                <Link
                  to={paths.grade}
                  className={buttonStyles(
                    {},
                    'bg-white/10 text-white shadow-none ring-1 ring-white/15 hover:bg-white/15',
                  )}
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

        <section className="card p-5 md:p-6" aria-labelledby="pendencias">
          <h2 id="pendencias" className="mb-2 font-display text-[18px] font-bold">
            Pendências
          </h2>
          {cadastrosLoading || scheduleLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-paper" />
              ))}
            </div>
          ) : pendencias.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-4">
              <span className="grid size-9 place-items-center rounded-full bg-accent text-ink">
                <Icon name="check" width={18} height={18} strokeWidth={2.4} />
              </span>
              <div>
                <p className="font-semibold">Nada pendente</p>
                <p className="text-[13.5px] text-muted">Cadastros completos e grade sem conflitos.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line-soft">
              {pendencias.map((p) => (
                <li key={p.title} className="flex flex-wrap items-center gap-3 py-3">
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full font-display text-[14px] font-bold tabular-nums',
                      p.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
                    )}
                  >
                    {p.count}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.title}</p>
                    <p className="truncate text-[13px] text-muted">{p.detail}</p>
                  </div>
                  <Link
                    to={p.to}
                    className={buttonStyles({ variant: p.tone === 'danger' ? 'primary' : 'secondary', size: 'sm' })}
                  >
                    {p.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {ultimaAlteracao && (
            <p className="mt-3 rounded-xl bg-paper px-3.5 py-2.5 text-[13px] text-muted">
              <span className="font-semibold text-ink">Última edição manual:</span> {ultimaAlteracao.descricao}
            </p>
          )}
        </section>

        <TurmasPanel turmas={turmas} lessons={lessons} hasGrade={Boolean(activeGrade)} loading={cadastrosLoading} />
      </div>

      {/* Coluna lateral: prontidão, cadastros e carga */}
      <div className="flex flex-col gap-4">
        <WorkflowCard percent={prontidao} loading={cadastrosLoading} conflitos={conflicts.length} />

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
              detail={
                semDisponibilidade ? `${semDisponibilidade} sem disponibilidade registrada` : 'Disponibilidade em dia'
              }
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

        <CargaPanel
          professores={ativos.flatMap((p) =>
            p.id != null ? [{ nome: p.nome, aulas: cargaPorProfessor.get(p.id) ?? 0, max: p.carga_maxima_aulas }] : [],
          )}
          loading={cadastrosLoading}
        />
      </div>
    </div>
  )
}

/** Uma ficha por turma: aulas na grade (ou previstas na matriz) e como se espalham pela semana */
function TurmasPanel({
  turmas,
  lessons,
  hasGrade,
  loading,
}: {
  turmas: TurmaBackend[]
  lessons: Lesson[]
  hasGrade: boolean
  loading: boolean
}) {
  return (
    <section className="card flex flex-1 flex-col p-5 md:p-6" aria-labelledby="turmas-painel">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="turmas-painel" className="font-display text-[18px] font-bold">
          Turmas
        </h2>
        <p className="text-[13px] text-muted">
          {hasGrade
            ? 'Aulas por dia na grade ativa. Clique numa turma para abrir a grade dela.'
            : 'Aulas previstas na matriz de cada turma.'}
        </p>
      </div>
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-paper" />
          ))}
        </div>
      ) : turmas.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-2xl border-2 border-dashed border-line p-8 text-center">
          <div>
            <p className="font-semibold">Nenhuma turma cadastrada</p>
            <Link to={paths.turmas} className={buttonStyles({ size: 'sm' }, 'mt-3')}>
              Cadastrar turmas
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] content-start gap-3">
          {turmas.map((t) => {
            const previstas = (t.matriz_curricular ?? []).reduce((acc, i) => acc + Number(i.aulas_semanais || 0), 0)
            const daTurma = lessons.filter((l) => l.classGroup === t.nome)
            const porDia = weekDays.map((d) => daTurma.filter((l) => l.day === d).length)
            const maxDia = Math.max(1, ...porDia)
            const faltam = hasGrade && previstas > 0 ? Math.max(0, previstas - daTurma.length) : 0
            const status =
              previstas === 0
                ? { text: 'Sem matriz', className: 'bg-warning-soft text-warning' }
                : faltam > 0
                  ? { text: `Faltam ${faltam}`, className: 'bg-danger-soft text-danger' }
                  : hasGrade
                    ? { text: 'Completa', className: 'bg-primary-soft text-primary' }
                    : { text: 'Matriz pronta', className: 'bg-paper text-muted' }
            return (
              <li key={t.id ?? t.nome}>
                <Link
                  to={
                    previstas === 0 || !hasGrade ? paths.turmas : `${paths.grade}?turma=${encodeURIComponent(t.nome)}`
                  }
                  className="group flex h-full flex-col rounded-2xl border border-line-soft p-4 transition-colors hover:border-ink/20 hover:bg-paper/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-[17px] font-bold">{t.nome}</p>
                      <p className="truncate text-[12.5px] text-muted">{t.turno}</p>
                    </div>
                    <span
                      className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', status.className)}
                    >
                      {status.text}
                    </span>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                    <p className="text-[13px] text-muted">
                      <span className="font-display text-[20px] font-bold text-ink tabular-nums">
                        {hasGrade ? daTurma.length : previstas}
                      </span>{' '}
                      aulas/sem
                    </p>
                    {hasGrade && (
                      <div
                        className="flex items-end gap-1"
                        role="img"
                        aria-label={`Aulas por dia: ${weekDays.map((d, i) => `${d} ${porDia[i]}`).join(', ')}`}
                      >
                        {porDia.map((n, i) => (
                          <span key={weekDays[i]} className="flex flex-col items-center gap-0.5">
                            <span
                              className="w-3 rounded-sm bg-ink/80 transition-colors group-hover:bg-primary"
                              style={{ height: `${Math.max(3, (n / maxDia) * 24)}px` }}
                            />
                            <span className="text-[9px] leading-none text-muted">{weekDays[i][0]}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Carga prevista pelas matrizes de cada professor ativo, da maior para a menor */
function CargaPanel({
  professores,
  loading,
}: {
  professores: { nome: string; aulas: number; max: number }[]
  loading: boolean
}) {
  const ordenados = [...professores].sort((a, b) => b.aulas - a.aulas)
  return (
    <section className="card flex min-h-[280px] flex-1 basis-0 flex-col p-5 md:p-6" aria-labelledby="carga-painel">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="carga-painel" className="font-display text-[18px] font-bold">
          Carga dos professores
        </h2>
        <Link to={paths.gradeProfessores} className="text-[13px] font-semibold text-primary hover:underline">
          Grade por professor
        </Link>
      </div>
      {loading ? (
        <div className="flex-1 animate-pulse rounded-2xl bg-paper" />
      ) : ordenados.length === 0 ? (
        <p className="text-[13.5px] text-muted">Nenhum professor ativo.</p>
      ) : (
        <ul className="-mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
          {ordenados.map((p) => {
            const acima = p.aulas > p.max
            const pct = p.max > 0 ? Math.min(100, (p.aulas / p.max) * 100) : 0
            return (
              <li key={p.nome}>
                <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="truncate font-medium">{p.nome}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    <span className={cn('font-semibold', acima ? 'text-danger' : 'text-ink')}>{p.aulas}</span> de{' '}
                    {p.max}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-line-soft">
                  <div
                    className={cn('h-full rounded-full', acima ? 'bg-danger' : 'bg-primary')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
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
            ? { to: paths.professoresSemDisponibilidade, label: 'Registrar disponibilidade' }
            : { to: paths.resumo, label: 'Ver resumo da grade' }

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
      hint: {
        done: 'Sem conflitos',
        current: `${conflitos} ${conflitos === 1 ? 'conflito' : 'conflitos'}`,
        todo: 'Aguardando grade',
      },
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
        <p className="font-display text-[32px] font-bold tracking-[-0.03em] tabular-nums">
          {loading ? '…' : `${percent}%`}
        </p>
      </div>

      <ol className="space-y-1">
        {rows.map((row, i) => {
          const state = steps[row.key]
          return (
            <li key={row.key}>
              <Link
                to={row.to}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-paper"
              >
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
                    state === 'current' && row.key === 'revisao' && conflitos > 0
                      ? 'font-semibold text-danger'
                      : 'text-muted',
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
