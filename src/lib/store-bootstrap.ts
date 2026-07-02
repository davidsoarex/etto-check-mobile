import { API_BASE_URL } from '@/lib/api'

export async function fetchStoreTradeName(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/cardapio/bootstrap`)
    if (!response.ok) return null
    const body = (await response.json()) as { store?: { tradeName?: string } }
    return body.store?.tradeName?.trim() || null
  } catch {
    return null
  }
}
