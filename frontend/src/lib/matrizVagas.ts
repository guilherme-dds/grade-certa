import { updateTurma, type TurmaBackend } from '@/api/turmas'

/** Uma disciplina da matriz de uma turma que ainda não tem professor */
export interface VagaMatriz {
  turma: TurmaBackend
  disciplina: string
}

// Compara sem acento e sem caixa (NFD separa o acento da letra; \p{M} remove as marcas)
const chave = (nome: string) => nome.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()

const semProfessor = (item: NonNullable<TurmaBackend['matriz_curricular']>[number]) =>
  !item.professor_ids?.length && !item.professores?.length && !item.professor

/**
 * Itens das matrizes sem professor que este professor pode assumir:
 * mesma disciplina e, quando os dois estão definidos, mesmo nível de ensino.
 */
export function vagasParaProfessor(turmas: TurmaBackend[], disciplinas: string[], niveis: string[] = []): VagaMatriz[] {
  const nomes = new Set(disciplinas.map(chave))
  return turmas.flatMap((turma) => {
    if (turma.id == null) return []
    if (niveis.length && turma.nivel_ensino && !niveis.includes(turma.nivel_ensino)) return []
    return (turma.matriz_curricular ?? [])
      .filter((item) => Number(item.aulas_semanais) > 0 && semProfessor(item) && nomes.has(chave(item.disciplina)))
      .map((item) => ({ turma, disciplina: item.disciplina }))
  })
}

/** Grava o professor nos itens vagos, uma requisição por turma */
export async function atribuirProfessor(vagas: VagaMatriz[], professorId: number) {
  const porTurma = new Map<number, { turma: TurmaBackend; disciplinas: Set<string> }>()
  for (const { turma, disciplina } of vagas) {
    const atual = porTurma.get(turma.id!) ?? { turma, disciplinas: new Set<string>() }
    atual.disciplinas.add(chave(disciplina))
    porTurma.set(turma.id!, atual)
  }
  await Promise.all(
    [...porTurma.values()].map(({ turma, disciplinas }) =>
      updateTurma(turma.id!, {
        ...turma,
        matriz_curricular: (turma.matriz_curricular ?? []).map((item) =>
          disciplinas.has(chave(item.disciplina)) && semProfessor(item)
            ? { ...item, professor_ids: [professorId] }
            : item,
        ),
      }),
    ),
  )
}

/** "Eletiva no 3º EM", "Eletiva no 3º EM e Arte no 1º EM", "… e mais 2" */
export function descreverVagas(vagas: VagaMatriz[], limite = 3): string {
  const partes = vagas.slice(0, limite).map((v) => `${v.disciplina} no ${v.turma.nome}`)
  const resto = vagas.length - partes.length
  if (resto > 0) return `${partes.join(', ')} e mais ${resto}`
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}` : (partes[0] ?? '')
}
