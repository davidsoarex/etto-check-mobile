import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import { formatPortalDate, formatPortalDateTime } from '@/lib/portal-format'
import {
  fetchSupervisorPendingValidations,
  type EcheckSupervisorValidationRow,
} from '@/services/echeck-api'

export function ValidationListPage() {
  const { portalToken, canValidateSubmissions } = useAuth()
  const [rows, setRows] = useState<EcheckSupervisorValidationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!portalToken || !canValidateSubmissions) return
    setIsLoading(true)
    void fetchSupervisorPendingValidations(portalToken)
      .then((res) => {
        setRows(res.data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar validações.'))
      .finally(() => setIsLoading(false))
  }, [canValidateSubmissions, portalToken])

  if (!canValidateSubmissions) {
    return (
      <section className="space-y-3">
        <Link
          to="/inicio"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep"
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Link>
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Você não tem permissão para validar registros.
        </p>
      </section>
    )
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
        title="Validação de registros"
        description="Revise as fotos enviadas pelos colaboradores e aprove ou rejeite."
      >
        {isLoading && <p className="px-4 py-5 text-sm text-slate-600">Carregando…</p>}
        {error && <p className="px-4 py-5 text-sm text-rose-600">{error}</p>}
        {!isLoading && !error && rows.length === 0 && (
          <p className="px-4 py-5 text-sm text-slate-600">Nenhum registro aguardando validação.</p>
        )}
        {!isLoading && !error && rows.length > 0 && (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <Link
                key={row.id}
                to={`/validacao/${row.id}`}
                className="flex items-center gap-3 px-4 py-3 transition active:bg-slate-50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-700">
                  <ClipboardCheck className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {row.routineName ?? 'Rotina'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.collaboratorName ?? 'Colaborador'} · {formatPortalDate(row.referenceDate)}
                  </p>
                  {row.submittedAt ? (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Enviado {formatPortalDateTime(row.submittedAt)}
                    </p>
                  ) : null}
                </div>
                <ChevronRight className="size-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        )}
      </PortalSectionCard>
    </section>
  )
}
