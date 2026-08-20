export type ConferencePackageDef = {
  quantity: number
  isDefault?: boolean
}

export type PackageBreakdown = {
  counts: Record<number, number>
  loose: number
}

export function computeTotalFromPackages(breakdown: PackageBreakdown): number {
  let total = 0
  for (const [qStr, count] of Object.entries(breakdown.counts)) {
    const q = Number(qStr)
    const c = Number(count)
    if (!Number.isFinite(q) || !Number.isFinite(c) || q <= 0 || c <= 0) continue
    total += q * Math.floor(c)
  }
  if (Number.isFinite(breakdown.loose) && breakdown.loose > 0) total += breakdown.loose
  return Math.round(total * 1000) / 1000
}

export function toApiBreakdown(
  packages: ConferencePackageDef[],
  breakdown: PackageBreakdown,
): { packages: Array<{ quantity: number; count: number }>; loose: number } {
  return {
    packages: packages.map((p) => ({
      quantity: p.quantity,
      count: Math.max(0, Math.floor(breakdown.counts[p.quantity] ?? 0)),
    })),
    loose: Math.max(0, Number(breakdown.loose) || 0),
  }
}

/** Heurística: preenche pacotes maiores primeiro; resto vira avulso. */
export function decomposeContado(
  contado: number,
  packages: ConferencePackageDef[],
): PackageBreakdown {
  const sorted = [...packages].sort((a, b) => b.quantity - a.quantity)
  let rem = Math.round(contado * 1000) / 1000
  const counts: Record<number, number> = {}
  for (const p of packages) counts[p.quantity] = 0
  for (const p of sorted) {
    const n = Math.floor(rem / p.quantity + 1e-9)
    counts[p.quantity] = n
    rem = Math.round((rem - n * p.quantity) * 1000) / 1000
  }
  return { counts, loose: rem > 0 ? rem : 0 }
}
