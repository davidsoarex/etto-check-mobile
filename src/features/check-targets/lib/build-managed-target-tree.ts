export type ManagedTargetNode<T extends { id: number; parentId: number | null }> = {
  row: T
  depth: number
}

/** Árvore a partir de lista plana (parentId). Órfãos sobem para a raiz. */
export function buildManagedTargetTree<T extends { id: number; parentId: number | null; name: string }>(
  rows: T[],
): Array<ManagedTargetNode<T>> {
  const byParent = new Map<number | null, T[]>()
  const ids = new Set(rows.map((row) => row.id))

  for (const row of rows) {
    const parentId = row.parentId != null && ids.has(row.parentId) ? row.parentId : null
    const list = byParent.get(parentId) ?? []
    list.push(row)
    byParent.set(parentId, list)
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }

  const visited = new Set<number>()
  const out: Array<ManagedTargetNode<T>> = []

  function walk(parentId: number | null, depth: number) {
    for (const row of byParent.get(parentId) ?? []) {
      if (visited.has(row.id)) continue
      visited.add(row.id)
      out.push({ row, depth })
      walk(row.id, depth + 1)
    }
  }

  walk(null, 0)
  return out
}
