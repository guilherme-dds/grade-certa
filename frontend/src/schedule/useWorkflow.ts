import { useQuery } from '@tanstack/react-query'
import { getProfessores } from '@/api/professores'
import { getTurmas } from '@/api/turmas'
import { useSchedule } from './useSchedule'

export type StepState = 'done' | 'current' | 'todo'

/**
 * Onde a escola está no fluxo "cadastrar → gerar → revisar".
 * Usa as mesmas queries das telas, então não gera requisições extras.
 */
export function useWorkflow() {
  const { activeGrade, conflicts, isLoading: scheduleLoading } = useSchedule()
  const turmasQuery = useQuery({ queryKey: ['turmas'], queryFn: getTurmas })
  const professoresQuery = useQuery({ queryKey: ['professores'], queryFn: () => getProfessores() })

  const turmas = turmasQuery.data ?? []
  const ativos = (professoresQuery.data ?? []).filter((p) => p.ativo)

  const turmasSemMatriz = turmas.filter(
    (t) => !(t.matriz_curricular || []).some((item) => Number(item.aulas_semanais) > 0),
  )
  const docentesSemDisponibilidade = ativos.filter((p) => !p.disponibilidade_atualizada_em)

  // Pode gerar com turmas prontas; a disponibilidade é recomendada, não obrigatória
  const podeGerar = turmas.length > 0 && turmasSemMatriz.length < turmas.length
  const cadastrosCompletos = podeGerar && turmasSemMatriz.length === 0 && docentesSemDisponibilidade.length === 0
  const temGrade = activeGrade != null
  const semConflitos = temGrade && conflicts.length === 0

  const steps: Record<'cadastros' | 'geracao' | 'revisao', StepState> = {
    cadastros: cadastrosCompletos ? 'done' : 'current',
    geracao: temGrade ? 'done' : podeGerar ? 'current' : 'todo',
    revisao: semConflitos ? 'done' : temGrade ? 'current' : 'todo',
  }

  return {
    isLoading: scheduleLoading || turmasQuery.isLoading || professoresQuery.isLoading,
    turmas,
    ativos,
    turmasSemMatriz,
    docentesSemDisponibilidade,
    podeGerar,
    steps,
  }
}
