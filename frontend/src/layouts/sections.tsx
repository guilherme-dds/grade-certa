import { Navigate, useLocation, useSearchParams } from 'react-router'
import { paths } from '@/config/paths'
import { useSchedule } from '@/schedule/useSchedule'
import { SectionLayout, SubTabs } from './SectionLayout'

export function CadastrosSection() {
  return <SectionLayout section="Cadastros" step={1} />
}

export function GeracaoSection() {
  return <SectionLayout section="Gerar grade" step={2} />
}

export function GradeSection() {
  const { activeGrade } = useSchedule()
  return (
    <SectionLayout
      section="Revisar grade"
      step={3}
      description={
        activeGrade
          ? `${activeGrade.nome}${activeGrade.ano_semestre ? `, semestre ${activeGrade.ano_semestre}` : ''}`
          : undefined
      }
    />
  )
}

/** Grade da semana vista por turma, por professor ou por sala */
export function GradeViews() {
  return (
    <SubTabs
      label="Ver a grade"
      tabs={[
        { to: paths.grade, label: 'Por turma', end: true, also: [paths.gradeImpressao] },
        { to: paths.gradeProfessores, label: 'Por professor' },
        { to: paths.gradeSalas, label: 'Por sala' },
      ]}
    />
  )
}

export function ConfiguracoesSection() {
  return <SectionLayout section="Configurações" />
}

/** Endereço antigo → novo, mantendo os parâmetros (ex.: ?matriz=3) */
export function Moved({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}

// Os relatórios eram uma aba só, com subabas em ?aba=; hoje cada um é uma aba de Revisar grade
const RELATORIO_ANTIGO: Record<string, string> = {
  geral: paths.resumo,
  professores: paths.gradeProfessores,
  turmas: paths.gradeImpressao,
  salas: paths.gradeSalas,
}

export function MovedRelatorios() {
  const [params] = useSearchParams()
  const destino = RELATORIO_ANTIGO[params.get('aba') ?? ''] ?? paths.resumo
  const resto = new URLSearchParams(params)
  resto.delete('aba')
  const query = resto.toString()
  return <Navigate to={query ? `${destino}?${query}` : destino} replace />
}
