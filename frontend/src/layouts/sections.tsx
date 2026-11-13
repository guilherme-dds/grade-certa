import { Navigate, useLocation } from 'react-router'
import { paths } from '@/config/paths'
import { useWorkflow } from '@/schedule/useWorkflow'
import { useSchedule } from '@/schedule/useSchedule'
import { SectionLayout } from './SectionLayout'

export function CadastrosSection() {
  const { turmas, ativos, turmasSemMatriz, docentesSemDisponibilidade } = useWorkflow()
  return (
    <SectionLayout
      step={1}
      title="Cadastros"
      description="Tudo o que o gerador precisa saber: quem ensina, quem aprende e onde."
      tabs={[
        {
          to: paths.professores,
          label: 'Professores',
          count: docentesSemDisponibilidade.length || ativos.length,
          countTone: docentesSemDisponibilidade.length ? 'danger' : 'neutral',
        },
        {
          to: paths.turmas,
          label: 'Turmas',
          count: turmasSemMatriz.length || turmas.length,
          countTone: turmasSemMatriz.length ? 'danger' : 'neutral',
        },
        { to: paths.salas, label: 'Salas' },
      ]}
    />
  )
}

export function GradeSection() {
  const { conflicts, activeGrade } = useSchedule()
  return (
    <SectionLayout
      step={3}
      title="Revisar grade"
      description={
        activeGrade
          ? `${activeGrade.nome}${activeGrade.ano_semestre ? ` · Semestre ${activeGrade.ano_semestre}` : ''}`
          : 'Veja a grade por turma, resolva conflitos e exporte relatórios.'
      }
      tabs={[
        { to: paths.grade, label: 'Por turma', end: true },
        { to: paths.conflitos, label: 'Conflitos', count: conflicts.length, countTone: 'danger' },
        { to: paths.relatorios, label: 'Relatórios' },
      ]}
    />
  )
}

export function ConfiguracoesSection() {
  return (
    <SectionLayout
      title="Configurações"
      tabs={[
        { to: paths.conta, label: 'Minha conta' },
        { to: paths.usuarios, label: 'Usuários' },
      ]}
    />
  )
}

/** Endereço antigo → novo, mantendo os parâmetros (ex.: ?matriz=3) */
export function Moved({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}
