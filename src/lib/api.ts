/** Mesmo padrão do etto-entregas-mobile: localhost em dev; em produção, mesma origem. */
function resolveApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_MANAGER_API_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (import.meta.env.PROD) return '/api/v1'
  return 'http://localhost:3333/api/v1'
}

export const API_BASE_URL = resolveApiBaseUrl()
