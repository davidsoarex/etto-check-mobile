import { Link, Navigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, MapPin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import {
  fetchManagedCheckTargets,
  kindLabel,
  type ManagedCheckTargetSummary,
} from '@/features/check-targets/api/check-targets-api'
import { buildManagedTargetTree } from '@/features/check-targets/lib/build-managed-target-tree'

export function ManagedTargetsListPage() {
  const { portalToken, canManageCheckTargets } = useAuth()
  const [rows, setRows] = useState<ManagedCheckTargetSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!portalToken || !canManageCheckTargets) return
    setIsLoading(true)
    void fetchManagedCheckTargets(portalToken)
      .then((res) => {
        setRows(res.data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar locais.'))
      .finally(() => setIsLoading(false))
  }, [canManageCheckTargets, portalToken])

  const tree = useMemo(() => buildManagedTargetTree(rows), [rows])

  if (!canManageCheckTargets) {
    return <Navigate to="/inicio" replace />
  }

  return (
    <section className="space-y-3">
      <Link
        to="/inicio"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep"
      >
        <ChevronLeft className="size-4" />
        Voltar ao início
      </Link>

      <PortalSectionCard
        title="Locais e equipamentos"
        description="Inclua ou troque a foto de referência de cada item. A estrutura continua no ERP."
      >
        {isLoading ? (
          <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin" />
            Carregando…
          </div>
        ) : null}
        {error ? <p className="px-4 py-5 text-sm text-rose-600">{error}</p> : null}
        {!isLoading && !error && tree.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-600">Nenhum local ativo nesta organização.</p>
        ) : null}
        {!isLoading && !error && tree.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {tree.map(({ row, depth }) => (
              <Link
                key={row.id}
                to={`/gestao/locais/${row.id}`}
                className="flex items-center gap-3 px-4 py-3 transition active:bg-slate-50"
                style={{ paddingLeft: `${16 + depth * 14}px` }}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-500/10 text-teal-800">
                  <MapPin className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {kindLabel(row.kind)}
                    {row.code ? ` · ${row.code}` : ''}
                    {` · ${row.activeItemCount} ${row.activeItemCount === 1 ? 'item' : 'itens'}`}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        ) : null}
      </PortalSectionCard>
    </section>
  )
}
