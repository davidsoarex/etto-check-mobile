/** Mesmo padrão do etto-entregas-mobile: localhost em dev, produção via .env.production */
export const API_BASE_URL =
  (import.meta.env.VITE_MANAGER_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3333/api/v1'
