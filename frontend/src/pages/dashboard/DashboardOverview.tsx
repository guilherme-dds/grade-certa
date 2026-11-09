import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getHistoricoGrades, type GradeResumo } from '@/api/grades'
import { getProfessores } from '@/api/professores'
import { getSalas } from '@/api/salas'
import { getTurmas } from '@/api/turmas'
import { useProfessorLogado } from '@/auth/useProfessorLogado'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { StatCard, StatGrid } from '@/components/ui/StatCard'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/schedule'
import { useSchedule } from '@/schedule/useSchedule'

const STATUS_LABEL: Record<string, string> = {
  gerando: 'Em andamento',
  sucesso: 'Sucesso',
  inviavel: 'Inviável',
  tempo_esgotado: 'Tempo esgotado',
  erro: 'Erro',
}

const STATUS_BADGE_STYLE: Record<string, string> = {
  sucesso: 'border-primary-soft-line bg-primary-soft text-primary',
  gerando: 'border-warning/30 bg-warning-soft text-warning animate-pulse',
  inviavel: 'border-danger/30 bg-danger-soft text-danger',
  tempo_esgotado: 'border-danger/30 bg-danger-soft text-danger',
  erro: 'border-danger/30 bg-danger-soft text-danger',
}

export function DashboardOverview() {
  const navigate = useNavigate()
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
  const semDisponibilidade = ativos.filter((p) => !p.disponibilidade_atualizada_em).length

  const ultimaGeracao = historico[0] as GradeResumo | undefined
  const ultimaGradeSucesso = historico.find((g) => g.status === 'sucesso')
  const isGerando = ultimaGeracao?.status === 'gerando'
  const isFalha = ultimaGeracao != null && ultimaGeracao.status !== 'gerando' && ultimaGeracao.status !== 'sucesso'

  // Análise de prontidão escolar para geração
  const turmasValidas = turmas.filter((t) => (t.matriz_curricular || []).some((item) => Number(item.aulas_semanais) > 0))
  const turmasSemMatriz = turmas.filter((t) => !(t.matriz_curricular || []).some((item) => Number(item.aulas_semanais) > 0))
  const totalAulasDemandadas = turmasValidas.reduce(
    (acc, t) => acc + (t.matriz_curricular || []).reduce((sub, item) => sub + Number(item.aulas_semanais || 0), 0),
    0,
  )

  // Aulas do docente logado na grade ativa (se houver correspondência de e-mail)
  const aulasDoProfessor = professor ? lessons.filter((l) => l.teachers.some((t) => t.id === professor.id)) : []
  const ultimaAlteracao = changes[0]

  return (
    <div className="space-y-6">
      {/* 1. Indicadores Principais (KPIs com links diretos) */}
      <StatGrid>
        <StatCard
          label="Grade ativa"
          value={activeGrade ? activeGrade.nome : ultimaGradeSucesso ? ultimaGradeSucesso.nome : 'Nenhuma gerada'}
          suffix={activeGrade ? `${activeGrade.total_aulas} aulas` : undefined}
          tone={activeGrade || ultimaGradeSucesso ? 'success' : 'warning'}
          size="md"
          to="/grade"
          isLoading={scheduleLoading || historicoQuery.isLoading}
        />
        <StatCard
          label="Conflitos pendentes"
          value={conflicts.length}
          suffix={conflicts.length === 1 ? 'conflito' : 'conflitos'}
          tone={conflicts.length > 0 ? 'danger' : 'success'}
          to="/conflitos"
          isLoading={scheduleLoading}
        />
        <StatCard
          label="Disponibilidade docente"
          value={semDisponibilidade}
          suffix={`sem info de ${ativos.length} ativos`}
          tone={semDisponibilidade > 0 ? 'warning' : 'success'}
          to="/professores"
          isLoading={professoresQuery.isLoading}
        />
        <StatCard
          label="Última geração"
          value={ultimaGeracao ? STATUS_LABEL[ultimaGeracao.status] ?? ultimaGeracao.status : '—'}
          suffix={ultimaGeracao?.criado_em ? formatDateTime(ultimaGeracao.criado_em) : undefined}
          tone={isGerando ? 'warning' : isFalha ? 'danger' : ultimaGeracao ? 'success' : 'default'}
          size="md"
          to="/geracao"
          isLoading={historicoQuery.isLoading}
        />
      </StatGrid>

      {/* 2. Banner de Status Contextual da Geração (em andamento ou falha recente) */}
      {isGerando && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3.5 text-[13px] text-ink">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-white animate-spin">
              ⟳
            </span>
            <div>
              <p className="font-semibold text-warning">Geração de grade em andamento</p>
              <p className="text-xs text-muted">
                O motor Google OR-Tools CP-SAT está processando a distribuição de horários em segundo plano.
              </p>
            </div>
          </div>
          <Link to="/geracao" className={buttonStyles({ size: 'sm' })}>
            Acompanhar geração em tempo real →
          </Link>
        </div>
      )}

      {isFalha && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3.5 text-[13px] text-danger">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger text-xs font-bold text-white">
              ✕
            </span>
            <div>
              <p className="font-semibold text-danger">A última tentativa de geração não foi viável</p>
              <p className="text-xs text-ink/80">
                {ultimaGeracao?.detalhes?.mensagem ?? 'O solver não encontrou solução para o conjunto de restrições.'}
              </p>
            </div>
          </div>
          <Link to="/geracao" className={buttonStyles({ variant: 'secondary', size: 'sm' }, 'border-danger/40')}>
            Ver diagnóstico e sugestões →
          </Link>
        </div>
      )}

      {/* 3. Atalho de Perfil Docente (visível se o usuário logado for professor) */}
      {professor && (
        <div className="rounded-xl border border-primary-soft-line bg-primary-soft/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary-soft-line bg-white px-2.5 py-0.5 text-xs font-semibold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Área do Professor: {professor.nome}
              </div>
              <p className="mt-2 text-sm text-ink font-medium">
                {activeGrade ? (
                  <>
                    Você possui <strong className="text-primary">{aulasDoProfessor.length}</strong> aulas alocadas na grade{' '}
                    <em>{activeGrade.nome}</em>.
                  </>
                ) : (
                  'Aguardando publicação de grade pelo coordenador pedagógico.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/minha-grade" className={buttonStyles({ size: 'sm' })}>
                Minha grade semanal
              </Link>
              <Link to="/professores" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                Minha disponibilidade
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 4. Painel duplo: Prontidão da Escola e Execuções Recentes */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Coluna 1: Diagnóstico de Prontidão da Escola */}
        <section className="rounded-xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-line-soft pb-3.5">
            <div>
              <h2 className="text-sm font-semibold text-ink">Prontidão para Nova Geração</h2>
              <p className="text-xs text-muted">Checagem de consistência cadastral antes de rodar o solver</p>
            </div>
            <Link to="/geracao" className="text-xs font-medium text-primary hover:underline">
              Ir para gerador →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Turmas com matriz cadastrada:</span>
              <span className="font-semibold text-ink">
                {turmasValidas.length} de {turmas.length} turmas
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Demanda semanal de aulas:</span>
              <span className="font-semibold text-ink">{totalAulasDemandadas} aulas / semana</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Professores ativos no quadro:</span>
              <span className="font-semibold text-ink">{ativos.length} docentes</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Salas de aula cadastradas:</span>
              <span className="font-semibold text-ink">{salas.length} salas</span>
            </div>

            {turmasSemMatriz.length > 0 && (
              <div className="mt-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-ink">
                <span className="font-semibold text-warning">Atenção:</span> {turmasSemMatriz.length}{' '}
                {turmasSemMatriz.length === 1 ? 'turma não tem' : 'turmas não têm'} matriz curricular cadastrada (
                {turmasSemMatriz.map((t) => t.nome).join(', ')}).{' '}
                <Link to="/disciplinas" className="font-medium text-warning hover:underline">
                  Configurar matrizes →
                </Link>
              </div>
            )}

            {turmasSemMatriz.length === 0 && turmasValidas.length > 0 && (
              <div className="mt-3 rounded-md border border-primary-soft-line bg-primary-soft/60 px-3 py-2 text-xs text-primary">
                ✓ Todas as turmas cadastradas possuem matriz pronta para otimização.
              </div>
            )}
          </div>
        </section>

        {/* Coluna 2: Histórico Recente de Grades */}
        <section className="rounded-xl border border-line bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-line-soft pb-3.5">
            <div>
              <h2 className="text-sm font-semibold text-ink">Execuções Recentes</h2>
              <p className="text-xs text-muted">Últimas grades computadas pelo sistema</p>
            </div>
            <Link to="/geracao" className="text-xs font-medium text-primary hover:underline">
              Ver histórico completo →
            </Link>
          </div>

          <div className="mt-4">
            {historico.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line p-6 text-center text-xs text-muted">
                Nenhuma grade gerada ainda. Clique em "Gerar grade agora" para iniciar.
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {historico.slice(0, 4).map((g) => (
                  <div key={g.id} className="flex items-center justify-between py-2.5 text-xs first:pt-0 last:pb-0">
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-semibold text-ink">{g.nome}</p>
                      <p className="text-[11px] text-muted">
                        {formatDateTime(g.criado_em)} · {g.total_aulas} aulas
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                          STATUS_BADGE_STYLE[g.status] ?? 'border-line bg-paper text-muted',
                        )}
                      >
                        {STATUS_LABEL[g.status] ?? g.status}
                      </span>
                      {g.status === 'sucesso' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await refreshSchedule(g.id)
                            navigate(`/grade?gradeId=${g.id}`)
                          }}
                          className="font-medium text-primary hover:underline"
                        >
                          Abrir →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {ultimaAlteracao && (
              <div className="mt-4 border-t border-line-soft pt-3 text-[11.5px] text-muted">
                <span className="font-semibold text-ink">Última edição manual:</span> {ultimaAlteracao.descricao}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 5. Ações Rápidas de Navegação */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2">
        <Link to="/geracao" className={buttonStyles()}>
          Gerar grade agora
        </Link>
        <Link to="/grade" className={buttonStyles({ variant: 'secondary' })}>
          Ver grade horária
        </Link>
        <Link to="/conflitos" className={buttonStyles({ variant: 'secondary' })}>
          Ver conflitos ({conflicts.length})
        </Link>
        <Link to="/disciplinas" className={buttonStyles({ variant: 'secondary' })}>
          Turmas e salas
        </Link>
        <Link to="/professores" className={buttonStyles({ variant: 'secondary' })}>
          Professores ({ativos.length})
        </Link>
      </div>
    </div>
  )
}
