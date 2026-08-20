/** Helpers leves de quantidade para contagem cega (sem saldo). */

function formatQty(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export function qtyStepForUnit(unit?: string | null): number {
  const u = (unit || '').trim().toLowerCase()
  if (!u) return 1
  if (u === 'un' || u === 'und' || u.startsWith('un')) return 1
  if (
    u.includes('kg') ||
    u === 'g' ||
    u.includes('lt') ||
    u === 'l' ||
    u.includes('ml') ||
    u.includes('litro')
  ) {
    return 0.1
  }
  if (u.includes('l') && !u.includes('un')) return 0.1
  return 1
}

export function formatQtyDraft(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return formatQty(n)
}

/** Aceita pt-BR: `1.234` / `1.234,5` / `1234,5`. */
function parseQtyInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '')
  if (!t) return null
  let normalized: string
  if (t.includes(',')) {
    normalized = t.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    normalized = t.replace(/\./g, '')
  } else {
    normalized = t
  }
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function normalizeQtyForUnit(raw: string, unit?: string | null): number | null {
  const parsed = parseQtyInput(raw)
  if (parsed == null) return null
  const step = qtyStepForUnit(unit)
  if (step >= 1) return Math.round(parsed)
  return Math.round(parsed * 1000) / 1000
}
