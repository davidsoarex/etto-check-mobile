import { describe, expect, it } from 'vitest'
import { buildManagedTargetTree } from './build-managed-target-tree'

describe('buildManagedTargetTree', () => {
  it('ordena filhos sob o pai e sobe órfãos', () => {
    const tree = buildManagedTargetTree([
      { id: 2, parentId: 1, name: 'Câmara' },
      { id: 1, parentId: null, name: 'Cozinha' },
      { id: 3, parentId: 99, name: 'Órfão' },
    ])
    expect(tree.map((n) => `${n.depth}:${n.row.name}`)).toEqual(['0:Cozinha', '1:Câmara', '0:Órfão'])
  })
})
