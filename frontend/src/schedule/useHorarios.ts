import { useQuery } from '@tanstack/react-query'
import { getHorarios } from '@/api/grades'

/** Horários de aula por nível de ensino, definidos no core-service (não mudam durante a sessão) */
export function useHorarios() {
  return useQuery({ queryKey: ['horarios'], queryFn: getHorarios, staleTime: Infinity })
}
