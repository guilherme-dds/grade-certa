import { rooms } from '@/mocks/data'

// Ainda não existe /salas no core-service. Enquanto isso, as salas ficam no localStorage
// com a mesma assinatura das outras funções de api/; quando o endpoint existir, basta trocar
// o corpo de cada função por api.get/post/put/delete('/salas/...').

export const TIPOS_SALA = ['Sala comum', 'Laboratório', 'Educação física'] as const

export interface SalaBackend {
  id?: number
  nome: string
  capacidade: number
  tipo: string
}

const SALAS_KEY = 'grade-certa:salas'

const initialSalas: SalaBackend[] = rooms.map((room, index) => ({
  id: index + 1,
  nome: room.name,
  capacidade: room.capacity,
  tipo: room.type,
}))

// Cópia em memória caso o localStorage esteja indisponível (modo privado, storage bloqueado)
let memorySalas: SalaBackend[] | null = null

function readSalas(): SalaBackend[] {
  try {
    const stored = localStorage.getItem(SALAS_KEY)
    if (stored) return JSON.parse(stored) as SalaBackend[]
  } catch {
    // cai na cópia em memória
  }
  return memorySalas ?? initialSalas
}

function writeSalas(salas: SalaBackend[]) {
  memorySalas = salas
  try {
    localStorage.setItem(SALAS_KEY, JSON.stringify(salas))
  } catch {
    // salas ficam apenas em memória
  }
}

export async function getSalas(): Promise<SalaBackend[]> {
  return readSalas()
}

export async function createSala(payload: Omit<SalaBackend, 'id'>): Promise<SalaBackend> {
  const salas = readSalas()
  const nextId = Math.max(0, ...salas.map((s) => s.id ?? 0)) + 1
  const sala = { ...payload, id: nextId }
  writeSalas([...salas, sala])
  return sala
}

export async function updateSala(id: number, payload: SalaBackend): Promise<SalaBackend> {
  const salas = readSalas()
  if (!salas.some((s) => s.id === id)) {
    throw new Error('Sala não encontrada')
  }
  const sala = { ...payload, id }
  writeSalas(salas.map((s) => (s.id === id ? sala : s)))
  return sala
}

export async function deleteSala(id: number): Promise<void> {
  writeSalas(readSalas().filter((s) => s.id !== id))
}
