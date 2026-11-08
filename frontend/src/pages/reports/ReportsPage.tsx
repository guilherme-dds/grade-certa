import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getHistoricoGrades } from '@/api/grades'
import { getProfessores } from '@/api/professores'
import { getSalas } from '@/api/salas'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/schedule'
import { useSchedule } from '@/schedule/useSchedule'
import { ClassScheduleReport } from './ClassScheduleReport'
import { OverviewReport } from './OverviewReport'
import { RoomScheduleReport } from './RoomScheduleReport'
import { TeacherScheduleReport } from './TeacherScheduleReport'
import { cargaPorProfessor, nomesOrdenados, ocupacaoSalas } from './reportMetrics'

const TODOS = 'todos'

const abas = [
  { id: 'geral', label: 'Visão geral' },
  { id: 'professores', label: 'Professores' },
  { id: 'turmas', label: 'Turmas' },
  { id: 'salas', label: 'Salas' },
] as const

// Aba e filtros ficam na URL: /relatorios?aba=salas&sala=…
export function ReportsPage() {
  const { lessons, conflicts, activeGrade, horariosTurmas, isLoading, refreshSchedule } = useSchedule()
  const [params, setParams] = useSearchParams()
  const { data: historico = [] } = useQuery({ queryKey: ['historicoGrades'], queryFn: getHistoricoGrades })
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })
  const salasQuery = useQuery({ queryKey: ['salas'], queryFn: getSalas })
  const gradesGeradas = historico.filter((g) => g.status === 'sucesso')

  const planejamentos = activeGrade?.detalhes?.planejamentos ?? []
  const janelas = activeGrade?.detalhes?.janelas ?? []
  const cargas = cargaPorProfessor(lessons, planejamentos, janelas, professoresQuery.data ?? [])
  const ocupacoes = ocupacaoSalas(salasQuery.data ?? [], lessons, horariosTurmas)

  const professores = nomesOrdenados(cargas.map((c) => c.nome))
  const turmas = nomesOrdenados(lessons.map((l) => l.classGroup))
  const salas = ocupacoes.map((o) => o.nome)

  const aba = abas.find((a) => a.id === params.get('aba'))?.id ?? 'geral'

  /** Filtro da URL; um valor fora da grade atual (ex.: depois de trocar de grade) volta ao primeiro */
  const filtro = (chave: string, opcoes: string[]) => {
    const valor = params.get(chave)
    return valor === TODOS || (valor && opcoes.includes(valor)) ? valor : (opcoes[0] ?? '')
  }
  const exibidos = (valor: string, opcoes: string[]) => (valor === TODOS ? opcoes : opcoes.filter((o) => o === valor))

  const professorEscolhido = filtro('professor', professores)
  const turmaEscolhida = filtro('turma', turmas)
  const salaEscolhida = filtro('sala', salas)

  const setParam = (chave: string, valor: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(chave, valor)
        return next
      },
      { replace: true },
    )

  const hrefDaAba = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('aba', id)
    return `?${next}`
  }

  if (isLoading || professoresQuery.isLoading || salasQuery.isLoading) {
    return <p className="py-16 text-center text-sm text-muted">Carregando grade...</p>
  }

  if (!activeGrade) {
    return (
      <>
        <PageHeader title="Relatórios" />
        <div className="max-w-xl rounded-lg border border-dashed border-line bg-white px-6 py-8">
          <p className="text-sm font-semibold">Nenhuma grade gerada</p>
          <p className="mt-1 text-[13px] text-muted">Os relatórios usam a grade gerada. Gere uma grade primeiro.</p>
          <Link to="/geracao" className={buttonStyles({ variant: 'secondary', size: 'sm' }, 'mt-4')}>
            Ir para geração
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={`${activeGrade.nome} · gerada em ${formatDateTime(activeGrade.criado_em)}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {gradesGeradas.length > 1 && (
              <ReportSelect
                label="Grade"
                value={String(activeGrade.id)}
                options={gradesGeradas.map((g) => ({
                  value: String(g.id),
                  label: `${g.nome} (${formatDateTime(g.criado_em)})`,
                }))}
                onChange={(v) => refreshSchedule(Number(v))}
              />
            )}
            {aba === 'professores' && (
              <ReportSelect
                label="Professor"
                value={professorEscolhido}
                options={opcoesComTodos('Todos os professores', professores)}
                onChange={(v) => setParam('professor', v)}
              />
            )}
            {aba === 'turmas' && (
              <ReportSelect
                label="Turma"
                value={turmaEscolhida}
                options={opcoesComTodos('Todas as turmas', turmas)}
                onChange={(v) => setParam('turma', v)}
              />
            )}
            {aba === 'salas' && (
              <ReportSelect
                label="Sala"
                value={salaEscolhida}
                options={opcoesComTodos('Todas as salas', salas)}
                onChange={(v) => setParam('sala', v)}
              />
            )}
            <Button variant="dark" onClick={() => window.print()}>
              Exportar PDF
            </Button>
          </div>
        }
      />

      <nav
        aria-label="Tipos de relatório"
        className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line print:hidden"
      >
        {abas.map(({ id, label }) => (
          <Link
            key={id}
            to={hrefDaAba(id)}
            replace
            aria-current={id === aba ? 'page' : undefined}
            className={cn(
              'border-b-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors',
              id === aba ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {(professoresQuery.isError || salasQuery.isError) && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-[13px]">
          Não foi possível carregar professores ou salas. Carga máxima e ocupação podem estar incompletas.
        </p>
      )}

      {aba === 'geral' && (
        <OverviewReport
          lessons={lessons}
          conflitos={conflicts.length}
          cargas={cargas}
          ocupacoes={ocupacoes}
          avisos={activeGrade.detalhes?.avisos}
        />
      )}

      <div className="flex flex-col gap-5 print:block">
        {aba === 'professores' &&
          exibidos(professorEscolhido, professores).map((professor) => (
            <TeacherScheduleReport
              key={professor}
              professor={professor}
              lessons={lessons}
              planejamentos={planejamentos}
              janelas={janelas}
            />
          ))}

        {aba === 'turmas' &&
          exibidos(turmaEscolhida, turmas).map((turma) => (
            <ClassScheduleReport key={turma} turma={turma} lessons={lessons} horariosTurmas={horariosTurmas} />
          ))}

        {aba === 'salas' &&
          ocupacoes
            .filter((o) => salaEscolhida === TODOS || o.nome === salaEscolhida)
            .map((ocupacao) => (
              <RoomScheduleReport key={ocupacao.nome} ocupacao={ocupacao} horariosTurmas={horariosTurmas} />
            ))}
      </div>
    </>
  )
}

function opcoesComTodos(rotulo: string, opcoes: string[]) {
  return [{ value: TODOS, label: rotulo }, ...opcoes.map((o) => ({ value: o, label: o }))]
}

interface ReportSelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

function ReportSelect({ label, value, options, onChange }: ReportSelectProps) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-line bg-white py-1 pr-1 pl-3 text-[12.5px] focus-within:border-primary">
      <span className="text-muted">{label}:</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-56 cursor-pointer bg-transparent py-1 pr-1 font-medium outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
