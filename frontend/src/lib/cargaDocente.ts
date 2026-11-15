import type { TurmaBackend } from '@/api/turmas'

/** Aulas por semana que as matrizes dão a cada professor (cada professor de uma aula em conjunto conta a aula inteira) */
export function demandaPorProfessor(turmas: TurmaBackend[]): Map<number, number> {
  const carga = new Map<number, number>()
  for (const t of turmas)
    for (const item of t.matriz_curricular ?? [])
      for (const id of item.professor_ids ?? []) carga.set(id, (carga.get(id) ?? 0) + Number(item.aulas_semanais || 0))
  return carga
}

/** Professores ativos que receberam mais aulas nas matrizes do que a carga máxima do cadastro */
export function professoresAcimaDaCarga<P extends { id?: number | null; ativo: boolean; carga_maxima_aulas: number }>(
  professores: P[],
  turmas: TurmaBackend[],
): { professor: P; aulas: number }[] {
  const demanda = demandaPorProfessor(turmas)
  return professores.flatMap((p) => {
    const aulas = p.id != null ? (demanda.get(p.id) ?? 0) : 0
    return p.ativo && aulas > p.carga_maxima_aulas ? [{ professor: p, aulas }] : []
  })
}
