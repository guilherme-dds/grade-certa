/** Endereços das telas, num lugar só para os links não divergirem. */
export const paths = {
  home: '/',
  cadastros: '/cadastros',
  professores: '/cadastros/professores',
  professoresSemDisponibilidade: '/cadastros/professores?filtro=sem-disponibilidade',
  turmas: '/cadastros/turmas',
  /** Abre direto a matriz curricular da turma */
  matrizDaTurma: (turmaId: number | string) => `/cadastros/turmas?matriz=${turmaId}`,
  salas: '/cadastros/salas',
  disciplinas: '/cadastros/disciplinas',
  geracao: '/geracao',
  geracaoRegras: '/geracao/regras',
  geracaoHistorico: '/geracao/historico',
  grade: '/grade',
  /** Grade de todas as turmas em sequência, para imprimir */
  gradeImpressao: '/grade/turmas/imprimir',
  /** Grade individual de cada professor, para imprimir e entregar */
  gradeProfessores: '/grade/professores',
  gradeSalas: '/grade/salas',
  resumo: '/grade/resumo',
  conflitos: '/grade/conflitos',
  configuracoes: '/configuracoes',
  conta: '/configuracoes/conta',
  usuarios: '/configuracoes/usuarios',
  escola: '/configuracoes/escola',
} as const
