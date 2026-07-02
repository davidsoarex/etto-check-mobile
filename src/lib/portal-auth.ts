export function normalizeCpfDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function formatCpf(value: string): string {
  const digits = normalizeCpfDigits(value)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function normalizeTransactionalPin(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4)
}

export function readPortalErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    if ('message' in body && typeof body.message === 'string' && body.message.trim()) {
      return body.message.trim()
    }
    if ('errors' in body && Array.isArray(body.errors) && body.errors.length > 0) {
      const first = body.errors[0]
      if (first && typeof first === 'object' && 'message' in first) {
        return String(first.message)
      }
    }
  }

  if (status === 401) return 'Sessão expirada. Entre novamente com CPF e senha.'
  if (status === 422) return 'Verifique o CPF e a senha transacional (4 dígitos).'
  if (status >= 500) return 'Servidor indisponível no momento. Tente novamente em instantes.'
  return 'Erro ao comunicar com o servidor.'
}
