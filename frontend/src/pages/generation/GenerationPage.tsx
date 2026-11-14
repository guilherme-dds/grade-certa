import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { gerarGrade, getHistoricoGrades, getStatusGrade, type GradeResumo } from '@/api/grades'
import { getProfessores, type ProfessorBackend } from '@/api/professores'
import { getTurmas, type TurmaBackend } from '@/api/turmas'
import { GenerationWarnings } from '@/components/GenerationWarnings'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Icon } from '@/components/ui/Icon'
import { Select } from '@/components/ui/Select'
import { paths } from '@/config/paths'
import { getApiErrorMessage } from '@/lib/apiError'
import { professoresAcimaDaCarga } from '@/lib/cargaDocente'
import { cn } from '@/lib/cn'
import { fixoIndisponivel, useDisponibilidades } from '@/lib/fixosIndisponiveis'
import { capacidadeSemanal, formatDateTime, horariosDaTurma } from '@/lib/schedule'
import { useHorarios } from '@/schedule/useHorarios'
import { useSchedule } from '@/schedule/useSchedule'
import { isFalha, STATUS_LABEL } from './generationShared'

/** Mesmo padrão do backend: "2026.2" para o 2º semestre de 2026 */
function semestreAtual() {
  const hoje = new Date()
  return `${hoje.getFullYear()}.${hoje.getMonth() < 6 ? 1 : 2}`
}

// Tempo máximo que o solver pode usar (o backend aceita até 15 min)
const TEMPOS_LIMITE = [
  { value: '60', label: '1 minuto' },
  { value: '120', label: '2 minutos' },
  { value: '300', label: '5 minutos' },
  { value: '600', label: '10 minutos' },
  { value: '900', label: '15 minutos' },
]

export function GenerationPage() {
  const queryClient = useQueryClient()
  const { refreshSchedule } = useSchedule()

  const [nomeGrade, setNomeGrade] = useState(`Grade ${semestreAtual()}`)
  const [tempoLimite, setTempoLimite] = useState('120')
  const [isStarting, setIsStarting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Geração acompanhada nesta tela (iniciada aqui ou já em andamento ao abrir a página)
  const [geracaoId, setGeracaoId] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const { data: turmas = [], isLoading: loadingTurmas } = useQuery<TurmaBackend[]>({
    queryKey: ['turmas'],
    queryFn: () => getTurmas(),
  })
  const { data: professores = [], isLoading: loadingProfessores } = useQuery<ProfessorBackend[]>({
    queryKey: ['professores'],
    queryFn: () => getProfessores(),
  })
  const { data: horarios, isLoading: loadingHorarios } = useHorarios()
  const { data: historico = [], isLoading: isLoadingHistorico } = useQuery<GradeResumo[]>({
    queryKey: ['historicoGrades'],
    queryFn: () => getHistoricoGrades(),
  })

  // Ao abrir a página com uma geração rodando (ex.: depois de recarregar), volta a acompanhá-la
  const emAndamento = historico.find((g) => g.status === 'gerando')
  const acompanhada = geracaoId ?? emAndamento?.id ?? null

  // Consulta o status a cada 2s enquanto o solver roda
  const { data: geracao } = useQuery({
    queryKey: ['statusGrade', acompanhada],
    queryFn: () => getStatusGrade(acompanhada!),
    enabled: acompanhada != null,
    refetchInterval: (query) => (query.state.data?.status === 'gerando' ? 2000 : false),
  })
  const isGenerating = isStarting || geracao?.status === 'gerando'

  useEffect(() => {
    if (!isGenerating) return
    const inicio = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - inicio) / 1000)), 1000)
    return () => {
      clearInterval(timer)
      setElapsed(0)
    }
  }, [isGenerating])

  // Quando a geração termina: atualiza o histórico e, se deu certo, a grade exibida no sistema
  const statusFinal = geracao && geracao.status !== 'gerando' ? geracao.status : null
  useEffect(() => {
    if (!statusFinal || !geracao) return
    queryClient.invalidateQueries({ queryKey: ['historicoGrades'] })
    if (statusFinal === 'sucesso') refreshSchedule(geracao.id)
  }, [statusFinal, geracao, queryClient, refreshSchedule])

  // Checagem antes de gerar
  const temMatriz = (t: TurmaBackend) => (t.matriz_curricular || []).some((item) => Number(item.aulas_semanais) > 0)
  const turmasValidas = turmas.filter(temMatriz)
  const turmasSemMatriz = turmas.filter((t) => !temMatriz(t))
  const aulasDaTurma = (t: TurmaBackend) =>
    (t.matriz_curricular || []).reduce((sub, item) => sub + Number(item.aulas_semanais || 0), 0)
  const totalAulasDemandadas = turmasValidas.reduce((acc, t) => acc + aulasDaTurma(t), 0)

  // Matriz que não fecha com os horários da turma: sobra horário vago ou falta horário para as aulas
  const descompasso = horarios
    ? turmasValidas.flatMap((t) => {
        const capacidade = capacidadeSemanal(t, horarios)
        const aulas = aulasDaTurma(t)
        return capacidade != null && aulas !== capacidade ? [{ turma: t, aulas, capacidade }] : []
      })
    : []
  const comVagos = descompasso.filter((d) => d.aulas < d.capacidade)
  const comExcesso = descompasso.filter((d) => d.aulas > d.capacidade)
  const listar = (itens: typeof descompasso) =>
    itens.map((d) => `${d.turma.nome} (${d.aulas} aulas, ${d.capacidade} horários)`).join(', ')
  const ativos = professores.filter((p) => p.ativo)
  const semDisponibilidade = ativos.filter((p) => !p.disponibilidade_atualizada_em)

  // Aulas que a escola prendeu num dia/horário (ex.: laboratório), para conferir antes de gerar
  const aulasFixas = turmas.flatMap((t) =>
    (t.matriz_curricular ?? []).filter((item) => item.horarios_fixos?.length).map((item) => ({ turma: t, item })),
  )

  // Professor com mais aulas nas matrizes do que a carga máxima: a geração para na hora
  const acimaDaCarga = professoresAcimaDaCarga(professores, turmas)

  // Aula fixada num horário que o professor marcou como indisponível: a grade não fecha
  const disponibilidades = useDisponibilidades(aulasFixas.flatMap(({ item }) => item.professor_ids ?? []))
  const fixosBloqueados = horarios
    ? aulasFixas.flatMap(({ turma, item }) =>
        (item.horarios_fixos ?? []).flatMap((fixo) =>
          (item.professor_ids ?? [])
            .filter((id) => fixoIndisponivel(fixo, horariosDaTurma(turma, horarios), disponibilidades.get(id) ?? []))
            .map((id) => ({
              texto: `${turma.nome}, ${item.disciplina} (${fixo.dia_semana}${fixo.horario ? ` ${fixo.horario}` : ''}, ${professores.find((p) => p.id === id)?.nome ?? 'professor'})`,
            })),
        ),
      )
    : []

  const handleGerar = async () => {
    if (turmasValidas.length === 0) {
      setErrorMessage('Nenhuma turma tem matriz curricular com aulas. Monte a matriz de ao menos uma turma.')
      return
    }
    setErrorMessage(null)
    setIsStarting(true)
    try {
      const iniciada = await gerarGrade(nomeGrade.trim() || `Grade ${semestreAtual()}`, Number(tempoLimite))
      queryClient.setQueryData(['statusGrade', iniciada.id], iniciada)
      setGeracaoId(iniciada.id)
      await queryClient.invalidateQueries({ queryKey: ['historicoGrades'] })
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Não foi possível iniciar a geração da grade.'))
    } finally {
      setIsStarting(false)
    }
  }

  const detalhes = geracao?.detalhes
  const planejamentos = detalhes?.planejamentos ?? []
  const limiteAtual = detalhes?.tempo_limite_seg ?? Number(tempoLimite)
  const loadingChecks = loadingTurmas || loadingProfessores || loadingHorarios

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Coluna esquerda: o que será usado */}
        <div className="space-y-4">
          <section className="card p-5 md:p-6" aria-labelledby="checagem">
            <h2 id="checagem" className="font-display text-[18px] font-bold">
              Antes de gerar
            </h2>
            <ul className="mt-3 divide-y divide-line-soft">
              <CheckItem
                state={loadingChecks ? 'loading' : turmasSemMatriz.length === 0 && turmas.length > 0 ? 'ok' : 'warn'}
                title="Turmas com matriz curricular"
                detail={
                  turmas.length === 0
                    ? 'Nenhuma turma cadastrada.'
                    : turmasSemMatriz.length
                      ? `Sem matriz: ${turmasSemMatriz.map((t) => t.nome).join(', ')}. Essas turmas ficam de fora.`
                      : 'Todas as turmas entram na grade.'
                }
                value={`${turmasValidas.length}/${turmas.length}`}
                action={
                  turmasSemMatriz.length > 0 || turmas.length === 0
                    ? { to: paths.turmas, label: 'Montar matrizes' }
                    : undefined
                }
              />
              <CheckItem
                state={loadingChecks ? 'loading' : descompasso.length === 0 ? 'ok' : 'warn'}
                title="Matrizes completas"
                detail={
                  descompasso.length === 0
                    ? 'A matriz de cada turma preenche exatamente os horários dela.'
                    : [
                        comVagos.length &&
                          `Vão sobrar horários vagos em ${listar(comVagos)}. Confira se falta alguma disciplina ou aula.`,
                        comExcesso.length &&
                          `Mais aulas que horários em ${listar(comExcesso)}. O gerador não consegue encaixar todas.`,
                      ]
                        .filter(Boolean)
                        .join(' ')
                }
                value={`${turmasValidas.length - descompasso.length}/${turmasValidas.length}`}
                action={descompasso.length ? { to: paths.turmas, label: 'Revisar matrizes' } : undefined}
              />
              <CheckItem
                state={loadingChecks ? 'loading' : acimaDaCarga.length === 0 ? 'ok' : 'error'}
                title="Carga dos professores"
                detail={
                  acimaDaCarga.length === 0
                    ? 'Nenhum professor recebeu mais aulas do que a carga máxima.'
                    : `Acima da carga máxima: ${acimaDaCarga
                        .map((a) => `${a.professor.nome} (${a.aulas} aulas, máximo ${a.professor.carga_maxima_aulas})`)
                        .join(', ')}. Assim a geração não fecha: aumente a carga ou passe aulas para outro professor.`
                }
                value={`${professores.filter((p) => p.ativo).length - acimaDaCarga.length}/${professores.filter((p) => p.ativo).length}`}
                action={
                  acimaDaCarga.length
                    ? { to: `${paths.professores}?filtro=acima-da-carga`, label: 'Ver professores' }
                    : undefined
                }
              />
              <CheckItem
                state={loadingChecks ? 'loading' : semDisponibilidade.length === 0 ? 'ok' : 'warn'}
                title="Disponibilidade registrada"
                detail={
                  semDisponibilidade.length
                    ? `${semDisponibilidade.length} sem disponibilidade registrada. Até você registrar, o gerador considera a semana toda livre para ${semDisponibilidade.length === 1 ? 'ele' : 'eles'}.`
                    : 'Todos os professores ativos têm disponibilidade registrada.'
                }
                value={`${ativos.length - semDisponibilidade.length}/${ativos.length}`}
                action={
                  semDisponibilidade.length
                    ? { to: paths.professoresSemDisponibilidade, label: 'Registrar disponibilidade' }
                    : undefined
                }
              />
              <CheckItem
                state={loadingChecks ? 'loading' : 'info'}
                title="Aulas por semana"
                detail="Soma das matrizes de todas as turmas."
                value={String(totalAulasDemandadas)}
              />
              <CheckItem
                state={loadingChecks ? 'loading' : fixosBloqueados.length ? 'error' : 'info'}
                title="Aulas fixadas em dia ou horário"
                detail={
                  fixosBloqueados.length
                    ? `Fixadas num horário em que o professor está indisponível: ${fixosBloqueados.map((f) => f.texto).join('; ')}. Mude o fixo ou a disponibilidade.`
                    : aulasFixas.length
                      ? 'Serão mantidas exatamente onde foram fixadas.'
                      : 'Nenhuma. Para fixar uma aula (ex.: laboratório), use a matriz da turma.'
                }
                value={String(aulasFixas.length)}
                action={aulasFixas.length ? { to: paths.geracaoRegras, label: 'Ver aulas fixadas' } : undefined}
              />
            </ul>
          </section>

          <UltimaGeracao historico={historico} carregando={isLoadingHistorico} />
        </div>

        {/* Coluna direita: gerar e acompanhar */}
        <section className="rounded-[28px] bg-board p-6 text-white lg:sticky lg:top-24" aria-labelledby="nova-grade">
          <h2 id="nova-grade" className="font-display text-[20px] font-bold">
            Nova grade
          </h2>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="nomeGrade" className="mb-1.5 block text-[13px] font-medium text-white/70">
                Nome da grade
              </label>
              <input
                id="nomeGrade"
                type="text"
                value={nomeGrade}
                disabled={isGenerating}
                onChange={(e) => setNomeGrade(e.target.value)}
                placeholder={`Ex.: Grade ${semestreAtual()} – versão final`}
                className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.07] px-3.5 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-white/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="tempoLimite" className="mb-1.5 block text-[13px] font-medium text-white/70">
                Tempo máximo de busca
              </label>
              <Select
                id="tempoLimite"
                label="Tempo máximo de busca"
                variant="dark"
                value={tempoLimite}
                disabled={isGenerating}
                onChange={setTempoLimite}
                options={TEMPOS_LIMITE}
              />
              <p className="mt-1.5 text-[12.5px] text-white/45">Escolas maiores precisam de mais tempo.</p>
            </div>
          </div>

          {isGenerating ? (
            <div className="mt-6" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-[13.5px]">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="size-3.5 animate-spin rounded-full border-2 border-accent border-r-transparent" />
                  Gerando…
                </span>
                <span className="text-white/55 tabular-nums">
                  {elapsed}s de até {Math.round(limiteAtual / 60)} min
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
                  style={{ width: `${Math.min(100, (elapsed / limiteAtual) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[12.5px] text-white/45">Pode sair desta tela; a geração continua.</p>
            </div>
          ) : (
            <Button
              onClick={handleGerar}
              disabled={turmasValidas.length === 0}
              size="lg"
              className="mt-6 w-full bg-white text-ink shadow-none hover:bg-white/90"
            >
              Gerar grade
            </Button>
          )}

          {errorMessage && (
            <p role="alert" className="mt-4 rounded-2xl bg-[#ff7a5c]/15 px-4 py-3 text-[13.5px] text-[#ffb3a1]">
              {errorMessage}
            </p>
          )}

          {/* Resultado */}
          {geracao?.status === 'sucesso' && (
            <div className="mt-5 rounded-2xl bg-white p-4 text-ink" role="status">
              <p className="flex items-center gap-2 font-display text-[16px] font-bold text-primary">
                <Icon name="check" width={18} height={18} />
                Grade gerada
              </p>
              <p className="mt-1 text-[13.5px] text-muted">
                {geracao.total_aulas} aulas distribuídas em {detalhes?.tempo_resolucao_seg ?? '—'} s.
                {planejamentos.length > 0 &&
                  ` Planejamentos compartilhados com colega da mesma área: ${planejamentos.filter((p) => p.compartilhado).length} de ${planejamentos.length}.`}
              </p>
              {(detalhes?.janelas?.length ?? 0) > 0 && (
                <div className="mt-3 border-t border-line pt-3 text-[13px]">
                  <p className="font-semibold text-warning">
                    Janelas que não puderam ser evitadas ({detalhes!.janelas!.length})
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                    {detalhes!.janelas!.map((j) => (
                      <li key={`${j.professor}-${j.dia_semana}-${j.horario}`}>
                        {j.professor}: {j.dia_semana}, {j.horario}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <GenerationWarnings avisos={detalhes?.avisos} />
              <Link to={paths.grade} className={buttonStyles({}, 'mt-4 w-full')}>
                Revisar grade
              </Link>
            </div>
          )}

          {geracao && isFalha(geracao.status) && (
            <div className="mt-5 rounded-2xl bg-white p-4 text-ink" role="alert">
              <p className="font-display text-[16px] font-bold text-danger">
                {geracao.status === 'tempo_esgotado'
                  ? 'O tempo acabou antes de achar uma grade'
                  : geracao.status === 'erro'
                    ? 'A geração falhou'
                    : 'Não existe grade possível com estes cadastros'}
              </p>
              <p className="mt-1 text-[13.5px]">
                {detalhes?.mensagem ??
                  'A geração foi interrompida (o serviço pode ter sido reiniciado). Tente de novo.'}
              </p>
              <p className="mt-3 text-[13px] font-semibold">O que costuma resolver</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-muted">
                {geracao.status === 'tempo_esgotado' && <li>Tentar de novo com um tempo máximo maior.</li>}
                <li>Conferir se as aulas da turma cabem nos horários do turno.</li>
                <li>Conferir se a carga máxima dos professores cobre a demanda.</li>
                <li>Conferir a disponibilidade dos professores nos dias e turnos das aulas.</li>
                <li>Revisar a jornada (almoço, máximo de aulas e de horas por dia) em Configurações › Escola.</li>
              </ul>
              <GenerationWarnings avisos={detalhes?.avisos} />
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function CheckItem({
  state,
  title,
  detail,
  value,
  action,
}: {
  /** error: a geração não fecha assim; warn: gera, mas vale conferir */
  state: 'ok' | 'warn' | 'error' | 'info' | 'loading'
  title: string
  detail: string
  value: string
  action?: { to: string; label: string }
}): ReactNode {
  return (
    <li className="flex items-start gap-3 py-3.5">
      <span
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
          state === 'ok' && 'bg-primary-soft text-primary',
          state === 'warn' && 'bg-warning-soft text-warning',
          state === 'error' && 'bg-danger-soft text-danger',
          (state === 'info' || state === 'loading') && 'bg-paper text-muted',
        )}
        aria-hidden="true"
      >
        {state === 'ok' ? (
          <Icon name="check" width={15} height={15} />
        ) : state === 'warn' || state === 'error' ? (
          <span className="text-[14px] font-bold">!</span>
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">{title}</span>
          <span className="font-display text-[17px] font-bold tabular-nums">{state === 'loading' ? '…' : value}</span>
        </p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{detail}</p>
        {action && (
          <Link
            to={action.to}
            className="mt-1.5 inline-block text-[13.5px] font-semibold text-ink underline-offset-2 hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
    </li>
  )
}

/** Resumo da geração mais recente, com atalho para o histórico completo */
function UltimaGeracao({ historico, carregando }: { historico: GradeResumo[]; carregando: boolean }) {
  const ultima = historico[0]
  return (
    <section className="card p-5 md:p-6" aria-labelledby="ultima-geracao">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ultima-geracao" className="font-display text-[18px] font-bold">
          Última geração
        </h2>
        {historico.length > 0 && (
          <Link to={paths.geracaoHistorico} className="text-[13px] font-semibold text-primary hover:underline">
            Ver histórico ({historico.length})
          </Link>
        )}
      </div>
      {carregando ? (
        <div className="mt-3 h-14 animate-pulse rounded-2xl bg-paper" />
      ) : !ultima ? (
        <p className="mt-2 text-[13.5px] text-muted">Nenhuma grade gerada ainda. A primeira aparece aqui.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{ultima.nome}</p>
            <p className="text-[13px] text-muted tabular-nums">
              {formatDateTime(ultima.criado_em)}
              {ultima.status === 'sucesso' && ` · ${ultima.total_aulas} aulas`}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap',
              ultima.status === 'sucesso' && 'bg-primary-soft text-primary',
              ultima.status === 'gerando' && 'bg-warning-soft text-warning',
              isFalha(ultima.status) && 'bg-danger-soft text-danger',
            )}
          >
            {STATUS_LABEL[ultima.status] ?? ultima.status}
          </span>
        </div>
      )}
    </section>
  )
}
