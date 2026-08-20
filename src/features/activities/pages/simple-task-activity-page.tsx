import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import {
  completeActivity,
  fetchActivitiesInbox,
  todayIsoLocal,
  type ActivityItem,
} from '@/features/activities/api/activities-api'

export function SimpleTaskActivityPage() {
  const { activityId: activityIdParam } = useParams()
  const activityId = Number(activityIdParam)
  const navigate = useNavigate()
  const { portalToken } = useAuth()

  const [item, setItem] = useState<ActivityItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!portalToken || !Number.isFinite(activityId) || activityId < 1) return
    setIsLoading(true)
    setError(null)
    try {
      const inbox = await fetchActivitiesInbox(portalToken, todayIsoLocal())
      const found =
        inbox.inProgress.find((row) => row.id === activityId) ??
        inbox.pending.find((row) => row.id === activityId) ??
        null
      if (!found) {
        setItem(null)
        setError('Tarefa não encontrada ou já finalizada.')
        return
      }
      if (found.type !== 'simple_task') {
        setItem(null)
        setError('Esta atividade não é uma tarefa simples.')
        return
      }
      setItem(found)
    } catch (e) {
      setItem(null)
      setError(e instanceof Error ? e.message : 'Erro ao abrir tarefa.')
    } finally {
      setIsLoading(false)
    }
  }, [portalToken, activityId])

  useEffect(() => {
    void load()
  }, [load])

  const canComplete = item?.canComplete === true

  const onComplete = async () => {
    if (!portalToken || !canComplete) return
    setCompleting(true)
    setError(null)
    try {
      await completeActivity(portalToken, activityId)
      navigate('/atividades', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao concluir tarefa.')
    } finally {
      setCompleting(false)
    }
  }

  if (!Number.isFinite(activityId) || activityId < 1) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center">
        <p className="text-sm text-slate-800">Atividade inválida.</p>
        <Link
          to="/atividades"
          className="mt-2 inline-flex items-center justify-center gap-1 text-sm font-medium text-brand-deep"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Voltar às atividades
        </Link>
      </section>
    )
  }

  const priorityLabel =
    item?.priority === 'urgent' ? 'Urgente' : item?.priority === 'high' ? 'Alta' : null
  const timeLabel =
    item?.scheduledTimeSnapshot && item.scheduledTimeSnapshot.length >= 4
      ? item.scheduledTimeSnapshot.slice(0, 5)
      : null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <Link
          to="/atividades"
          className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-deep"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          Atividades
        </Link>
      </div>

      <PortalSectionCard
        title={item?.titleSnapshot ?? 'Tarefa'}
        description="Marque como feita quando concluir. A própria ocorrência é a execução."
      >
        {isLoading && <p className="px-4 py-5 text-sm text-slate-600">Carregando…</p>}
        {error && <p className="px-4 py-3 text-sm text-rose-600">{error}</p>}

        {!isLoading && item ? (
          <div className="space-y-4 px-4 py-4">
            {(timeLabel || priorityLabel) && (
              <p className="text-xs text-slate-500">
                {[timeLabel, priorityLabel].filter(Boolean).join(' · ')}
              </p>
            )}
            {item.status === 'in_progress' ? (
              <p className="text-xs font-medium text-slate-700">Em andamento</p>
            ) : null}
            <button
              type="button"
              className="min-h-11 w-full rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!canComplete || completing}
              onClick={() => void onComplete()}
            >
              {completing ? 'Concluindo…' : 'Concluir'}
            </button>
          </div>
        ) : null}
      </PortalSectionCard>
    </section>
  )
}
