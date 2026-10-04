const TOKEN_KEY = 'grade-certa:token'

// localStorage pode lançar exceção (modo privado, storage bloqueado)
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // sessão fica apenas em memória
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // nada a fazer
    }
  },
}
