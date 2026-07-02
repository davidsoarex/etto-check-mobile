import { Link } from 'react-router-dom'
import { Camera, ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '@/features/auth/context/use-auth'
import { useEffect, useState } from 'react'
import { fetchEcheckRoutines, type EcheckRoutineSession } from '@/services/echeck-api'
import { PortalSectionCard } from '@/components/portal-section-card'

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
      return 'text-brand-deep'
  }
}

export function HomePage() {
  const { portalToken, collaboratorName, logout } = useAuth()
  const [sessions, setSessions] = useState<EcheckRoutineSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!portalToken) return
    setIsLoading(true)
    void fetchEcheckRoutines(portalToken)
      .then((res) => {
        setSessions(res.data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar rotinas.'))
      .finally(() => setIsLoading(false))
  }, [portalToken])

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Olá</p>
            <h1 className="text-lg font-bold text-slate-900">{collaboratorName}</h1>
            <p className="mt-1 text-xs text-slate-600">Registre as fotos das rotinas atribuídas a você.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-2 text-slate-500"
            aria-label="Sair"
            onClick={logout}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      <PortalSectionCard
        title="Rotinas de hoje"
        description="Toque em uma rotina para registrar as fotos das tarefas."
      >
        {isLoading && <p className="px-4 py-5 text-sm text-slate-600">Carregando…</p>}
        {error && <p className="px-4 py-5 text-sm text-rose-600">{error}</p>}
        {!isLoading && !error && sessions.length === 0 && (
          <p className="px-4 py-5 text-sm text-slate-600">Nenhuma rotina atribuída no momento.</p>
        )}
        {!isLoading && !error && sessions.length > 0 && (
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <Link
                key={session.routine.id}
                to={`/rotinas/${session.routine.id}`}
                className="flex items-center gap-3 px-4 py-3 transition active:bg-slate-50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-deep/10 text-brand-deep">
                  <Camera className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{session.routine.name}</p>
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
        )}
      </PortalSectionCard>
    </section>
  )
}
