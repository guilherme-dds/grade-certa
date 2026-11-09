import { useQuery } from '@tanstack/react-query'
import { getProfessores } from '@/api/professores'
import { useAuth } from './useAuth'

/** Cadastro de professor do usuário logado; a ligação entre os dois é pelo e-mail. */
export function useProfessorLogado() {
  const { user } = useAuth()
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })

  const email = user?.email.trim().toLowerCase()
  const professor = professoresQuery.data?.find((p) => p.email.trim().toLowerCase() === email)

  return { user, professor, isLoading: professoresQuery.isLoading, isSuccess: professoresQuery.isSuccess }
}
