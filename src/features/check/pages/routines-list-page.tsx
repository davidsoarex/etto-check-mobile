import { Link } from 'react-router-dom'
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/context/use-auth'
import {
  fetchEcheckRoutines,
  type EcheckRoutineSession,
} from '@/services/echeck-api'

function statusLabel(status: string): string {
  switch (status) {
    case 'pending_validation':
      return 'Aguardando validação'
    case 'approved':
      return 'Aprovado'
    case 'rejected':
      return 'Rejeitado'
    default:
      return 'Em andamento'
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'pending_validation':
      return 'text-amber-700'
    case 'approved':
      return 'text-emerald-700'
    case 'rejected':
      return 'text-rose-700'
    default:
      return 'text-violet-800'
  }
}

export function RoutinesListPage() {
  const { portalToken, hasRoutineAccess } = useAuth()
  const [sessions, setSessions] = useState<EcheckRoutineSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!portalToken || !hasRoutineAccess) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    void fetchEcheckRoutines(portalToken)
      .then((res) => {
        setSessions(res.data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar rotinas.'))
      .finally(() => setIsLoading(false))
  }, [hasRoutineAccess, portalToken])

  if (!hasRoutineAccess) {
    return (
      <section className="space-y-3">
        <Link to="/inicio" className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep">
          <ChevronLeft className="size-4" />
          Início
        </Link>
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600 shadow-sm">
          Nenhuma rotina fotográfica atribuída a você.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <Link to="/inicio" className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep">
          <ChevronLeft className="size-4" />
          Início
        </Link>
        <h1 className="text-base font-bold text-slate-900">Rotinas</h1>
        <span className="w-14" aria-hidden />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? <p className="px-4 py-5 text-sm text-slate-600">Carregando…</p> : null}
        {error ? <p className="px-4 py-5 text-sm text-rose-600">{error}</p> : null}
        {!isLoading && !error && sessions.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-600">Nenhuma rotina atribuída no momento.</p>
        ) : null}
        {!isLoading && !error && sessions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <Link
                key={session.routine.id}
                to={`/rotinas/${session.routine.id}`}
                className="flex items-center gap-3 px-4 py-3 transition active:bg-slate-50"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-800">
                  <Camera className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {session.routine.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {session.submission.completedCount}/{session.submission.requiredCount} fotos ·{' '}
                    <span className={statusClass(session.submission.status)}>
                      {statusLabel(session.submission.status)}
                    </span>
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
