import { isAxiosError } from 'axios'

interface FastApiValidationError {
  loc: (string | number)[]
  msg: string
}

/** Extrai uma mensagem legível do `detail` retornado pelo FastAPI. */
export function getApiErrorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.') {
  if (!isAxiosError(error)) return fallback
  if (!error.response || error.response.status >= 500) {
    return 'Servidor indisponível no momento. Tente novamente em instantes.'
  }

  const detail = (error.response.data as { detail?: unknown } | undefined)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return (detail as FastApiValidationError[]).map((d) => d.msg).join(' ')
  }
  return fallback
}
