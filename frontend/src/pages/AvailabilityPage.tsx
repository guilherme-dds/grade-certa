import { useQuery } from '@tanstack/react-query'
import { getProfessores } from '@/api/professores'
import { useAuth } from '@/auth/useAuth'
import { ProfessorAvailabilityEditor } from '@/components/ProfessorAvailabilityEditor'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDateTime } from '@/lib/schedule'

export function AvailabilityPage() {
  const { user } = useAuth()
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })

  // O usuário logado é ligado ao cadastro de professor pelo e-mail
  const email = user?.email.trim().toLowerCase()
  const professor = professoresQuery.data?.find((p) => p.email.trim().toLowerCase() === email)

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
        {professoresQuery.isLoading && <p className="py-8 text-center text-sm text-muted">Carregando...</p>}
        {professoresQuery.isSuccess && !professor && (
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
