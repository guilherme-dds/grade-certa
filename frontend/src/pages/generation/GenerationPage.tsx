import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTurmas, type TurmaBackend } from '@/api/turmas'
import { getProfessores, type ProfessorBackend } from '@/api/professores'
import { gerarGrade, getHistoricoGrades, getStatusGrade, type GradeResumo, type StatusGrade } from '@/api/grades'
import { useSchedule } from '@/schedule/useSchedule'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/schedule'

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

const STATUS_LABEL: Record<string, string> = {
  gerando: 'gerando',
  sucesso: 'sucesso',
  inviavel: 'inviável',
  tempo_esgotado: 'tempo esgotado',
  erro: 'erro',
}

const isFalha = (status: StatusGrade) => status !== 'gerando' && status !== 'sucesso'

export function GenerationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refreshSchedule } = useSchedule()

  const [nomeGrade, setNomeGrade] = useState(`Grade Horária ${semestreAtual()}`)
  const [tempoLimite, setTempoLimite] = useState('120')
  const [isStarting, setIsStarting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Geração acompanhada nesta tela (iniciada aqui ou já em andamento ao abrir a página)
  const [geracaoId, setGeracaoId] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const { data: turmas = [] } = useQuery<TurmaBackend[]>({
    queryKey: ['turmas'],
    queryFn: () => getTurmas(),
  })

  const { data: professores = [] } = useQuery<ProfessorBackend[]>({
    queryKey: ['professores'],
    queryFn: () => getProfessores(),
  })

  const {
    data: historico = [],
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useQuery<GradeResumo[]>({
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

  // Análise diagnóstica pré-geração
  const turmasValidas = turmas.filter((t) => (t.matriz_curricular || []).some((item) => Number(item.aulas_semanais) > 0))
  const turmasSemMatriz = turmas.filter((t) => !(t.matriz_curricular || []).some((item) => Number(item.aulas_semanais) > 0))
  const totalAulasDemandadas = turmasValidas.reduce(
    (acc, t) => acc + (t.matriz_curricular || []).reduce((sub, item) => sub + Number(item.aulas_semanais || 0), 0),
    0,
  )
  const professoresAtivos = professores.filter((p) => p.ativo)

  const handleGerar = async () => {
    if (turmasValidas.length === 0) {
      setErrorMessage(
        'Nenhuma turma possui matriz curricular com aulas cadastradas. Configure ao menos uma turma para gerar a grade.',
      )
      return
    }
    setErrorMessage(null)
    setIsStarting(true)
    try {
      const iniciada = await gerarGrade(nomeGrade.trim() || 'Grade Horária Automática', Number(tempoLimite))
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Geração Automática de Grade"
        description="Resolvedor matemático via Google OR-Tools CP-SAT. Distribui aulas respeitando matrizes curriculares, níveis de ensino, indisponibilidades de professores e salas, aulas dobradas, ausência de janelas e 4 horários de planejamento por professor."
      />

      {/* 1. Diagnóstico Pré-Geração */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">Diagnóstico do Sistema</h2>
        <StatGrid>
          <StatCard
            label="Turmas Prontas"
            value={turmasValidas.length}
            suffix={`de ${turmas.length} turmas`}
            tone={turmasValidas.length > 0 ? 'success' : 'danger'}
          />
          <StatCard label="Aulas Demandadas" value={totalAulasDemandadas} suffix="aulas/semana" tone="default" />
          <StatCard
            label="Professores Ativos"
            value={professoresAtivos.length}
            suffix={`de ${professores.length} cadastrados`}
            tone={professoresAtivos.length > 0 ? 'success' : 'warning'}
          />
          <StatCard label="Grades no Histórico" value={historico.length} suffix="execuções" tone="default" />
        </StatGrid>

        {/* Alerta de turmas sem matriz */}
        {turmasSemMatriz.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-[13px] text-ink">
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-white">
                !
              </span>
              <span>
                <strong>Atenção:</strong> {turmasSemMatriz.length}{' '}
                {turmasSemMatriz.length === 1 ? 'turma não possui' : 'turmas não possuem'} matriz curricular cadastrada
                ({turmasSemMatriz.map((t) => t.nome).join(', ')}).
              </span>
            </div>
            <Link to="/disciplinas" className="font-medium text-warning hover:underline">
              Configurar turmas →
            </Link>
          </div>
        )}

        {/* Status de Prontidão */}
        {turmasValidas.length > 0 && (
          <div className="rounded-lg border border-primary-soft-line bg-primary-soft/60 px-4 py-3 text-[13px] text-primary">
            <span className="font-semibold">✓ Dados consistentes:</span> O sistema possui turmas com matriz curricular
            prontas para processamento no motor de otimização.
          </div>
        )}
      </section>

      {/* 2. Painel de Execução do Solver */}
      <section className="rounded-xl border border-line bg-white p-6 shadow-xs">
        <h2 className="text-base font-semibold text-ink">Executar Otimização da Grade</h2>
        <p className="mt-1 text-xs text-muted">
          A geração roda em segundo plano: você pode sair desta página e voltar depois. Escolas maiores precisam de mais
          tempo para o solver encontrar uma grade.
        </p>

        <div className="mt-5 grid max-w-xl gap-4 sm:grid-cols-[1fr_180px]">
          <div>
            <label htmlFor="nomeGrade" className="block text-xs font-medium text-ink">
              Nome de identificação da grade
            </label>
            <input
              id="nomeGrade"
              type="text"
              value={nomeGrade}
              disabled={isGenerating}
              onChange={(e) => setNomeGrade(e.target.value)}
              placeholder={`Ex: Grade Horária ${semestreAtual()} - Versão Final`}
              className="mt-1.5 w-full rounded-md border border-line bg-white px-3.5 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="tempoLimite" className="block text-xs font-medium text-ink">
              Tempo máximo
            </label>
            <select
              id="tempoLimite"
              value={tempoLimite}
              disabled={isGenerating}
              onChange={(e) => setTempoLimite(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-50"
            >
              {TEMPOS_LIMITE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 sm:col-span-2">
            <Button
              onClick={handleGerar}
              disabled={isGenerating || turmasValidas.length === 0}
              className="flex items-center gap-2 font-medium"
            >
              {isGenerating ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Gerando... ({elapsed}s de até {Math.round(limiteAtual / 60)} min)</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Gerar Grade Automática</span>
                </>
              )}
            </Button>

            {historico.some((g) => g.status === 'sucesso') && !isGenerating && (
              <Button variant="secondary" onClick={() => navigate('/grade')}>
                Visualizar Grade Atual
              </Button>
            )}
          </div>
        </div>

        {/* 3. Erro ao iniciar */}
        {errorMessage && (
          <div className="mt-6 rounded-lg border border-danger/40 bg-danger-soft p-4 text-[13px] text-danger">
            {errorMessage}
          </div>
        )}

        {/* 4. Geração que não encontrou grade */}
        {geracao && isFalha(geracao.status) && (
          <div className="mt-6 rounded-lg border border-danger/40 bg-danger-soft p-4 text-[13px] text-danger">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger text-sm font-bold text-white">
                ✕
              </span>
              <div className="space-y-2">
                <h3 className="font-semibold text-danger">
                  {geracao.status === 'tempo_esgotado'
                    ? 'Tempo esgotado'
                    : geracao.status === 'erro'
                      ? 'Erro na geração'
                      : 'Não foi possível montar a grade'}
                </h3>
                <p className="text-ink">
                  {detalhes?.mensagem ?? 'A geração foi interrompida (o serviço pode ter sido reiniciado). Tente novamente.'}
                </p>
                <div className="text-xs text-muted">
                  <strong>Sugestões para solucionar:</strong>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {geracao.status === 'tempo_esgotado' && <li>Tente de novo com um tempo máximo maior.</li>}
                    <li>Verifique se o número de aulas demandadas pela turma cabe nos horários semanais do turno.</li>
                    <li>Verifique se algum professor atribuído está com carga máxima menor que a demanda.</li>
                    <li>Confirme se os professores possuem disponibilidade nos dias e turnos das aulas.</li>
                  </ul>
                </div>
                <Avisos avisos={detalhes?.avisos} />
              </div>
            </div>
          </div>
        )}

        {/* 5. Feedback de Sucesso */}
        {geracao?.status === 'sucesso' && (
          <div className="mt-6 rounded-lg border border-primary-soft-line bg-primary-soft p-5 text-ink">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-primary">Grade gerada com sucesso!</h3>
                  <p className="text-xs text-muted">
                    {geracao.total_aulas} aulas distribuídas em {detalhes?.tempo_resolucao_seg ?? '—'} segundos.
                    {planejamentos.length > 0 &&
                      ` Planejamentos compartilhados com colega da mesma área: ${planejamentos.filter((p) => p.compartilhado).length}/${planejamentos.length}.`}
                  </p>
                </div>
              </div>

              <Link to="/grade" className={buttonStyles()}>
                Ver Grade Completa →
              </Link>
            </div>
            {(detalhes?.janelas?.length ?? 0) > 0 && (
              <div className="mt-4 border-t border-black/5 pt-3 text-xs">
                <p className="font-semibold text-warning">
                  Janelas de professor que não puderam ser evitadas ({detalhes!.janelas!.length})
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
            <Avisos avisos={detalhes?.avisos} />
          </div>
        )}
      </section>

      {/* 6. Histórico de Execuções */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">Histórico de Execuções</h2>
          <button
            type="button"
            onClick={() => refetchHistorico()}
            disabled={isLoadingHistorico}
            className="text-xs font-medium text-primary hover:underline"
          >
            Atualizar lista
          </button>
        </div>

        {historico.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-xs text-muted">
            Nenhuma geração registrada no histórico ainda.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-paper text-muted">
                  <th className="px-4 py-2.5 font-semibold">Nome da Grade</th>
                  <th className="px-4 py-2.5 font-semibold">Semestre</th>
                  <th className="px-4 py-2.5 font-semibold">Total Aulas</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Criado em</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((g) => (
                  <tr key={g.id} className="border-b border-line-soft last:border-b-0 hover:bg-paper/40">
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {g.nome}
                      {g.detalhes?.tempo_resolucao_seg != null && (
                        <span className="ml-2 text-[11px] text-muted">({g.detalhes.tempo_resolucao_seg}s)</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{g.ano_semestre ?? '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{g.total_aulas}</td>
                    <td className="px-4 py-2.5">
                      <span
                        title={isFalha(g.status) ? g.detalhes?.mensagem : undefined}
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          g.status === 'sucesso' && 'bg-primary-soft text-primary',
                          g.status === 'gerando' && 'bg-warning-soft text-warning',
                          isFalha(g.status) && 'bg-danger-soft text-danger',
                        )}
                      >
                        {STATUS_LABEL[g.status] ?? g.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{formatDateTime(g.criado_em)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {g.status === 'sucesso' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await refreshSchedule(g.id)
                            navigate(`/grade?gradeId=${g.id}`)
                          }}
                          className="font-semibold text-primary hover:underline"
                        >
                          Visualizar →
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Avisos({ avisos }: { avisos?: string[] }) {
  if (!avisos?.length) return null
  return (
    <div className="mt-4 border-t border-black/5 pt-3 text-xs">
      <p className="font-semibold text-warning">Avisos</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
        {avisos.map((aviso) => (
          <li key={aviso}>{aviso}</li>
        ))}
      </ul>
    </div>
  )
}
