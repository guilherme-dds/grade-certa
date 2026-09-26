import type { User } from '@/api/types'

export type Role = 'admin' | 'coordenacao' | 'professor'

export const roles: Role[] = ['admin', 'coordenacao', 'professor']

export const roleLabels: Record<Role, string> = {
  admin: 'Administrador(a)',
  coordenacao: 'Coordenação',
  professor: 'Professor(a)',
}

export const roleShortLabels: Record<Role, string> = {
  admin: 'Admin',
  coordenacao: 'Coord.',
  professor: 'Prof.',
}

// O backend ainda não expõe perfil no usuário; até lá todos entram como coordenação.
export function getUserRole(user: User): Role {
  return user.role ?? 'coordenacao'
}
