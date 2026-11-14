import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getHistoricoGrades } from '@/api/grades'
import { getProfessores } from '@/api/professores'
import { getSalas } from '@/api/salas'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { paths } from '@/config/paths'
import { TabHeader } from '@/layouts/SectionLayout'
import { formatDateTime } from '@/lib/schedule'
import { useSchedule } from '@/schedule/useSchedule'
import { ClassScheduleReport } from './ClassScheduleReport'
import { OverviewReport } from './OverviewReport'
import { RoomScheduleReport } from './RoomScheduleReport'
import { TeacherScheduleReport } from './TeacherScheduleReport'
import { cargaPorProfessor, nomesOrdenados, ocupacaoSalas } from './reportMetrics'

const TODOS = 'todos'

export type AbaRelatorio = 'resumo' | 'professores' | 'turmas' | 'salas'

const TITULO: Record<AbaRelatorio, string> = {
  resumo: 'Resumo da grade',
  professores: 'Grade por professor',
  turmas: 'Impressão por turma',
  salas: 'Grade por sala',
}

const DESCRICAO: Record<AbaRelatorio, string> = {
  resumo: 'Indicadores da grade, carga dos professores e ocupação das salas.',
  professores: 'Grade individual de cada professor, com planejamentos e janelas. Pronta para imprimir e entregar.',
  turmas: 'Grade de cada turma em sequência, uma por página na impressão.',
  salas: 'Ocupação de cada sala ao longo da semana.',
}

// Filtros ficam na URL: /grade/salas?sala=…
export function ReportsPage({ aba }: { aba: AbaRelatorio }) {
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

  if (isLoading || professoresQuery.isLoading || salasQuery.isLoading) {
    return <p className="py-16 text-center text-sm text-muted">Carregando grade...</p>
  }

  if (!activeGrade) {
    return (
      <>
        <div className="max-w-xl rounded-[20px] border-2 border-dashed border-line bg-white/60 px-6 py-8">
          <p className="text-sm font-semibold">Nenhuma grade gerada</p>
          <p className="mt-1 text-[13px] text-muted">Esta visão usa a grade gerada. Gere uma grade primeiro.</p>
          <Link to={paths.geracao} className={buttonStyles({ variant: 'secondary', size: 'sm' }, 'mt-4')}>
            Gerar grade
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <TabHeader
        title={TITULO[aba]}
        description={`${DESCRICAO[aba]} Grade gerada em ${formatDateTime(activeGrade.criado_em)}.`}
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
            {aba === 'turmas' && (
              <Link to={paths.grade} className={buttonStyles({ variant: 'secondary' })}>
                Voltar à grade
              </Link>
            )}
            <Button variant="dark" onClick={() => window.print()}>
              {aba === 'resumo' ? 'Exportar PDF' : 'Imprimir'}
            </Button>
          </div>
        }
      />

      {(professoresQuery.isError || salasQuery.isError) && (
        <p role="alert" className="mb-4 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-[13px]">
          Não foi possível carregar professores ou salas. Carga máxima e ocupação podem estar incompletas.
        </p>
      )}

      {aba === 'resumo' && (
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
    <label className="flex items-center gap-1 rounded-xl border border-line bg-white py-1 pr-1 pl-3 text-[12.5px] focus-within:border-primary">
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
