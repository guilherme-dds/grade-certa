import { useProfessorLogado } from '@/auth/useProfessorLogado'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDateTime } from '@/lib/schedule'
import { TeacherScheduleReport } from '@/pages/reports/TeacherScheduleReport'
import { useSchedule } from '@/schedule/useSchedule'

export function MyGradePage() {
  const { user, professor, isLoading: isLoadingProfessor, isSuccess } = useProfessorLogado()
  const { lessons, activeGrade, isLoading } = useSchedule()

  if (isLoading || isLoadingProfessor) {
    return <p className="py-16 text-center text-sm text-muted">Carregando grade...</p>
  }

  if (isSuccess && !professor) {
    return (
      <>
        <PageHeader title="Minha grade" />
        <div className="max-w-xl rounded-lg border border-line bg-white px-6 py-8">
          <p className="text-sm font-semibold">Seu usuário não está vinculado a um professor</p>
          <p className="mt-1 text-[13px] text-muted">
            Peça à coordenação para cadastrar um professor com o e-mail {user?.email}.
          </p>
        </div>
      </>
    )
  }

  if (!activeGrade || !professor) {
    return (
      <>
        <PageHeader title="Minha grade" />
        <div className="max-w-xl rounded-lg border border-dashed border-line bg-white px-6 py-8">
          <p className="text-sm font-semibold">Nenhuma grade gerada</p>
          <p className="mt-1 text-[13px] text-muted">Seus horários aparecem aqui quando a coordenação gerar a grade.</p>
        </div>
      </>
    )
  }

  // A grade guarda o nome escrito na matriz curricular, que pode diferir do cadastro
  const nomeNaGrade = lessons.flatMap((l) => l.teachers).find((t) => t.id === professor.id)?.nome ?? professor.nome

  return (
    <>
      <PageHeader
        title="Minha grade"
        description={`${activeGrade.nome} · gerada em ${formatDateTime(activeGrade.criado_em)}.`}
        actions={
          <Button variant="dark" onClick={() => window.print()} className="print:hidden">
            Exportar PDF
          </Button>
        }
      />
      <TeacherScheduleReport
        professor={nomeNaGrade}
        lessons={lessons}
        planejamentos={activeGrade.detalhes?.planejamentos ?? []}
        janelas={activeGrade.detalhes?.janelas ?? []}
      />
    </>
  )
}
