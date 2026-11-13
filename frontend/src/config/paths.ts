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
  geracao: '/geracao',
  grade: '/grade',
  conflitos: '/grade/conflitos',
  relatorios: '/grade/relatorios',
  minhaGrade: '/minha-grade',
  configuracoes: '/configuracoes',
  conta: '/configuracoes/conta',
  usuarios: '/configuracoes/usuarios',
} as const
