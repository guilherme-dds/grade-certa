import { useSyncExternalStore } from 'react'

export type Tema = 'claro' | 'escuro'

const CHAVE = 'grade-certa:tema'
const ouvintes = new Set<() => void>()

/* O padrão é o tema claro; o escuro só vale para quem o escolher no botão do topo. */

function aplicar(tema: Tema) {
  if (tema === 'escuro') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
  ouvintes.forEach((ouvir) => ouvir())
}

export function setTema(tema: Tema) {
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    // Sem armazenamento (aba privada): o tema vale só até recarregar
  }
  aplicar(tema)
}

function inscrever(ouvir: () => void) {
  ouvintes.add(ouvir)
  return () => ouvintes.delete(ouvir)
}

const lerDoDocumento = (): Tema => (document.documentElement.dataset.theme === 'dark' ? 'escuro' : 'claro')

export function useTema(): Tema {
  return useSyncExternalStore(inscrever, lerDoDocumento)
}
