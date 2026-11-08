import { useProfessorLogado } from '@/auth/useProfessorLogado'
import { ProfessorAvailabilityEditor } from '@/components/ProfessorAvailabilityEditor'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDateTime } from '@/lib/schedule'

export function AvailabilityPage() {
  const { user, professor, isLoading, isSuccess } = useProfessorLogado()

  return (
    <>
      <PageHeader
        title={`Disponibilidade — ${professor?.nome ?? user?.name}`}
        description={
          professor?.disponibilidade_atualizada_em
            ? `Última atualização em ${formatDateTime(professor.disponibilidade_atualizada_em)}.`
            : 'Marque os horários em que você não pode dar aula e os que prefere, conforme cada nível de ensino.'
        }
      />

      <div className="max-w-[720px] rounded-lg border border-line bg-white p-5">
        {isLoading && <p className="py-8 text-center text-sm text-muted">Carregando...</p>}
        {isSuccess && !professor && (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold">Seu usuário não está vinculado a um professor</p>
            <p className="mt-1 text-[13px] text-muted">
              Peça à coordenação para cadastrar um professor com o e-mail {user?.email}.
            </p>
          </div>
        )}
        {professor && <ProfessorAvailabilityEditor professor={professor} />}
      </div>
    </>
  )
}
