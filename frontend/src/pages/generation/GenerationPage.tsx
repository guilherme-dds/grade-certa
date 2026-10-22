import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTurmas, type TurmaBackend } from '@/api/turmas'
import { getProfessores, type ProfessorBackend } from '@/api/professores'
import {
  gerarGrade,
  getHistoricoGrades,
  type GradeResumo,
  type ResultadoGeracaoGrade,
} from '@/api/grades'
import { useSchedule } from '@/schedule/useSchedule'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { cn } from '@/lib/cn'

export function GenerationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refreshSchedule } = useSchedule()

  const [nomeGrade, setNomeGrade] = useState('Grade Horária 2026.2')
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [lastResult, setLastResult] = useState<ResultadoGeracaoGrade | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  // 1. Busca dados das Turmas
  const { data: turmas = [] } = useQuery<TurmaBackend[]>({
    queryKey: ['turmas'],
    queryFn: () => getTurmas(),
  })

  // 2. Busca dados dos Professores
  const { data: professores = [] } = useQuery<ProfessorBackend[]>({
    queryKey: ['professores'],
    queryFn: () => getProfessores(),
  })

  // 3. Busca Histórico de Grades Geradas
  const {
    data: historico = [],
    isLoading: isLoadingHistorico,
    refetch: refetchHistorico,
  } = useQuery<GradeResumo[]>({
    queryKey: ['historicoGrades'],
    queryFn: () => getHistoricoGrades(),
  })

  // Limpeza de timer caso o componente desmonte
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Análise diagnóstica pré-geração
  const turmasValidas = turmas.filter((t) => {
    const matriz = t.matriz_curricular || []
    return matriz.some((item) => Number(item.aulas_semanais) > 0)
  })

  const turmasSemMatriz = turmas.filter((t) => {
    const matriz = t.matriz_curricular || []
    return !matriz.some((item) => Number(item.aulas_semanais) > 0)
  })

  const totalAulasDemandadas = turmasValidas.reduce((acc, t) => {
    const matriz = t.matriz_curricular || []
    return acc + matriz.reduce((sub, item) => sub + Number(item.aulas_semanais || 0), 0)
  }, 0)

  const professoresAtivos = professores.filter((p) => p.ativo)

  const handleGerar = async () => {
    if (turmasValidas.length === 0) {
      setErrorMessage(
        'Nenhuma turma possui matriz curricular com aulas cadastradas. Configure ao menos uma turma para gerar a grade.',
      )
      return
    }

    setIsGenerating(true)
    setErrorMessage(null)
    setLastResult(null)
    setElapsedTime(0)
    startTimeRef.current = Date.now()

    timerRef.current = window.setInterval(() => {
      const delta = (Date.now() - startTimeRef.current) / 1000
      setElapsedTime(Number(delta.toFixed(1)))
    }, 100)

    try {
      const resultado = await gerarGrade(nomeGrade.trim() || 'Grade Horária Automática')
      if (timerRef.current) clearInterval(timerRef.current)
      setLastResult(resultado)
      // Atualiza o histórico e a grade ativa no contexto global
      await queryClient.invalidateQueries({ queryKey: ['historicoGrades'] })
      refetchHistorico()
      if (resultado.grade_id) {
        await refreshSchedule(resultado.grade_id)
      }
    } catch (err: unknown) {
      if (timerRef.current) clearInterval(timerRef.current)
      let msg = 'Ocorreu um erro ao processar a grade horária.'
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        if (axiosErr.response?.data?.detail) {
          msg = axiosErr.response.data.detail
        }
      } else if (err instanceof Error) {
        msg = err.message
      }
      setErrorMessage(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  const formatData = (isoStr?: string) => {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    } catch {
      return isoStr
    }
  }

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
          <StatCard
            label="Aulas Demandadas"
            value={totalAulasDemandadas}
            suffix="aulas/semana"
            tone="default"
          />
          <StatCard
            label="Professores Ativos"
            value={professoresAtivos.length}
            suffix={`de ${professores.length} cadastrados`}
            tone={professoresAtivos.length > 0 ? 'success' : 'warning'}
          />
          <StatCard
            label="Grades no Histórico"
            value={historico.length}
            suffix="execuções"
            tone="default"
          />
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
            <Link
              to="/disciplinas"
              className="font-medium text-warning hover:underline"
            >
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
          Defina o nome de identificação desta versão da grade e inicie o algoritmo de busca por soluções ótimas.
        </p>

        <div className="mt-5 grid max-w-xl gap-4">
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
              placeholder="Ex: Grade Horária 2026.2 - Versão Final"
              className="mt-1.5 w-full rounded-md border border-line bg-white px-3.5 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
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
                  <span>Processando CP-SAT... ({elapsedTime}s)</span>
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

            {historico.length > 0 && !isGenerating && (
              <Button
                variant="secondary"
                onClick={() => navigate('/grade')}
              >
                Visualizar Grade Atual
              </Button>
            )}
          </div>
        </div>

        {/* 3. Feedback de Inviabilidade / Erro */}
        {errorMessage && (
          <div className="mt-6 rounded-lg border border-danger/40 bg-danger-soft p-4 text-[13px] text-danger">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger text-sm font-bold text-white">
                ✕
              </span>
              <div className="space-y-2">
                <h3 className="font-semibold text-danger">Inviabilidade ou Erro na Geração</h3>
                <p className="text-ink">{errorMessage}</p>
                <div className="text-xs text-muted">
                  <strong>Sugestões para solucionar:</strong>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    <li>Verifique se o número de aulas demandadas pela turma cabe nos horários semanais do turno.</li>
                    <li>Verifique se algum professor atribuído está com carga máxima menor que a demanda.</li>
                    <li>Confirme se os professores possuem disponibilidade nos dias e turnos das aulas.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Feedback de Sucesso */}
        {lastResult && lastResult.sucesso && (
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
                    {lastResult.total_aulas} aulas distribuídas em {lastResult.tempo_seg ?? elapsedTime} segundos.
                  </p>
                </div>
              </div>

              <Link to="/grade" className={buttonStyles()}>
                Ver Grade Completa →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 5. Histórico de Execuções */}
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
                      {g.detalhes && typeof g.detalhes === 'object' && 'tempo_resolucao_seg' in g.detalhes && (
                        <span className="ml-2 text-[11px] text-muted">
                          ({Number(g.detalhes.tempo_resolucao_seg)}s)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{g.ano_semestre ?? '2026.2'}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{g.total_aulas}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          g.status === 'sucesso'
                            ? 'bg-primary-soft text-primary'
                            : 'bg-danger-soft text-danger',
                        )}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{formatData(g.criado_em)}</td>
                    <td className="px-4 py-2.5 text-right">
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
