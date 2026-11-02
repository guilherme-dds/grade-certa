import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getHistoricoGrades } from '@/api/grades'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDateTime } from '@/lib/schedule'
import { useSchedule } from '@/schedule/useSchedule'
import { TeacherScheduleReport } from './TeacherScheduleReport'

const TODOS = 'todos'

export function ReportsPage() {
  const { lessons, activeGrade, isLoading, refreshSchedule } = useSchedule()
  const [params, setParams] = useSearchParams()
  const { data: historico = [] } = useQuery({ queryKey: ['historicoGrades'], queryFn: getHistoricoGrades })
  const gradesGeradas = historico.filter((g) => g.status === 'sucesso')

  const planejamentos = activeGrade?.detalhes?.planejamentos ?? []
  const janelas = activeGrade?.detalhes?.janelas ?? []
  const professores = Array.from(
    new Set([...lessons.flatMap((l) => l.teachers.map((t) => t.nome)), ...planejamentos.map((p) => p.professor)]),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const escolhido = params.get('professor') ?? professores[0] ?? ''
  const exibidos = escolhido === TODOS ? professores : professores.filter((p) => p === escolhido)

  const setProfessor = (valor: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('professor', valor)
        return next
      },
      { replace: true },
    )

  if (isLoading) {
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
        title="Relatórios — Grade por professor"
        description={`${activeGrade.nome} · gerada em ${formatDateTime(activeGrade.criado_em)}. Aulas, planejamentos e janelas de cada professor na semana.`}
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
            <ReportSelect
              label="Professor"
              value={escolhido}
              options={[{ value: TODOS, label: 'Todos os professores' }, ...professores.map((p) => ({ value: p, label: p }))]}
              onChange={setProfessor}
            />
            <Button variant="secondary" onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        {exibidos.map((professor) => (
          <TeacherScheduleReport
            key={professor}
            professor={professor}
            lessons={lessons}
            planejamentos={planejamentos}
            janelas={janelas}
          />
        ))}
      </div>
    </>
  )
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
