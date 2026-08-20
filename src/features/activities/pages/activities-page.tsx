import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Boxes, CheckSquare, ChevronLeft, ChevronRight, Home, ListTodo } from 'lucide-react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import {
  claimActivity,
  fetchActivitiesInbox,
  startActivity,
  todayIsoLocal,
  type ActivitiesInboxResponse,
  type ActivityItem,
} from '@/features/activities/api/activities-api'
import {
  activityPath,
  filterInboxByScope,
  type ActivityInboxScope,
} from '@/features/activities/lib/activity-inbox-scope'

export type { ActivityInboxScope }
export { activityPath, filterInboxByScope, isConferenceItem } from '@/features/activities/lib/activity-inbox-scope'

function priorityLabel(p: string): string {
  if (p === 'urgent') return 'Urgente'
  if (p === 'high') return 'Alta'
  return ''
}

function typeLabel(item: ActivityItem): string {
  if (item.typeLabel) return item.typeLabel
  if (item.type === 'inventory_conference') return 'Conferência'
  if (item.type === 'checklist') return 'Checklist'
  if (item.type === 'simple_task') return 'Tarefa'
  return item.type
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  const weekday = dt.toLocaleDateString('pt-BR', { weekday: 'long' })
  const dayMonth = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  return `${weekdayCap}, ${dayMonth}`
}

function ActivityCard({
  item,
  actionLabel,
  busy,
  onAction,
  muted,
  scope,
}: {
  item: ActivityItem
  actionLabel: string
  busy: boolean
  onAction: () => void
  muted?: boolean
  scope: ActivityInboxScope
}) {
  const pri = priorityLabel(item.priority)
  const time =
    item.scheduledTimeSnapshot && item.scheduledTimeSnapshot.length >= 4
      ? item.scheduledTimeSnapshot.slice(0, 5)
      : null
  const progress =
    item.progress && item.progress.total > 0
      ? `${item.progress.counted}/${item.progress.total}`
      : null
  const result =
    item.completionResult === 'partial'
      ? 'Parcial'
      : item.completionResult === 'complete'
        ? 'Total'
        : null
  const Icon = scope === 'conferences' ? Boxes : ListTodo
  const locationLabel =
    scope === 'conferences' ? item.stockLocationName?.trim() || null : null
  const leadLabel = scope === 'activities' ? typeLabel(item) : null

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${muted ? 'opacity-90' : ''}`}>
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${
          scope === 'conferences'
            ? 'bg-teal-500/15 text-teal-800'
            : 'bg-brand-deep/10 text-brand-deep'
        }`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{item.titleSnapshot}</p>
          {scope === 'conferences' && locationLabel ? (
            <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900">
              {locationLabel}
            </span>
          ) : null}
          {item.isOverdue ? (
            <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
              Atrasada
            </span>
          ) : null}
          {result === 'Parcial' ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              Parcial
            </span>
          ) : null}
        </div>
        {(() => {
          const rest = [time, pri, progress, result && result !== 'Parcial' ? result : null].filter(
            Boolean,
          )
          if (scope === 'activities' && leadLabel) rest.unshift(leadLabel)
          return rest.length > 0 ? (
            <p className="mt-0.5 text-xs text-slate-500">{rest.join(' · ')}</p>
          ) : null
        })()}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onAction}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
          muted
            ? 'bg-slate-100 text-slate-700'
            : scope === 'conferences'
              ? 'bg-teal-700 text-white'
              : 'bg-brand-deep text-white'
        }`}
      >
        {busy ? '…' : actionLabel}
      </button>
    </div>
  )
}

type Props = {
  scope?: ActivityInboxScope
}

export function ActivitiesPage({ scope = 'activities' }: Props) {
  const { portalToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const historyOnly = searchParams.get('view') === 'historico'
  const date = todayIsoLocal()
  const [inboxRaw, setInboxRaw] = useState<ActivitiesInboxResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const listPath = scope === 'conferences' ? '/conferencias' : '/atividades'
  const titleNoun = scope === 'conferences' ? 'conferências' : 'atividades'
  const headerLabel = historyOnly
    ? scope === 'conferences'
      ? 'Histórico de conferências'
      : 'Histórico do dia'
    : scope === 'conferences'
      ? 'Conferências'
      : 'Minhas atividades'

  const inbox = inboxRaw ? filterInboxByScope(inboxRaw, scope) : null

  const load = useCallback(async () => {
    if (!portalToken) return
    setLoading(true)
    try {
      const data = await fetchActivitiesInbox(portalToken, date)
      setInboxRaw(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : `Erro ao carregar ${titleNoun}.`)
    } finally {
      setLoading(false)
    }
  }, [portalToken, date, titleNoun])

  useEffect(() => {
    void load()
  }, [load])

  const goActivity = (item: ActivityItem, opts?: { view?: boolean }) => {
    const path = activityPath(item)
    if (!path) return
    if (opts?.view && item.type === 'inventory_conference') {
      return
    }
    navigate(opts?.view ? `${path}?view=1` : path)
  }

  const onContinue = (item: ActivityItem) => {
    goActivity(item)
  }

  const onStart = async (item: ActivityItem) => {
    if (!portalToken) return
    setBusyId(item.id)
    try {
      await startActivity(portalToken, item.id)
      goActivity(item)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar.')
    } finally {
      setBusyId(null)
    }
  }

  const onClaim = async (item: ActivityItem) => {
    if (!portalToken) return
    setBusyId(item.id)
    try {
      await claimActivity(portalToken, item.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao assumir.')
    } finally {
      setBusyId(null)
    }
  }

  const empty =
    !loading &&
    !error &&
    inbox &&
    (historyOnly
      ? inbox.completed.length === 0
      : inbox.summary.inProgress === 0 &&
        inbox.summary.pending === 0 &&
        inbox.summary.available === 0 &&
        inbox.summary.completed === 0)

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {historyOnly ? (
              <Link
                to={listPath}
                className="mb-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-brand-deep"
              >
                <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
                Voltar às {titleNoun}
              </Link>
            ) : null}
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {headerLabel}
            </p>
            <h1 className="mt-0.5 text-lg font-bold leading-snug text-slate-900">
              {formatDateLabel(date)}
            </h1>
            {historyOnly ? null : (
              <Link
                to={`${listPath}?view=historico`}
                className="mt-1.5 inline-block text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
              >
                Ver histórico de hoje
              </Link>
            )}
          </div>
          <Link
            to="/inicio"
            aria-label="Início"
            title="Início"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-brand-deep transition hover:bg-slate-100"
          >
            <Home className="size-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>

      {loading ? <p className="px-1 text-sm text-slate-600">Carregando…</p> : null}
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {empty ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600 shadow-sm">
          {historyOnly
            ? `Nenhuma ${scope === 'conferences' ? 'conferência concluída' : 'atividade concluída'} hoje.`
            : `Nenhuma ${scope === 'conferences' ? 'conferência' : 'atividade'} para hoje.`}
        </p>
      ) : null}

      {!historyOnly && inbox && inbox.inProgress.length > 0 ? (
        <PortalSectionCard title={`Em andamento (${inbox.inProgress.length})`}>
          <div className="divide-y divide-slate-100">
            {inbox.inProgress.map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
                scope={scope}
                actionLabel="Continuar"
                busy={busyId === item.id}
                onAction={() => onContinue(item)}
              />
            ))}
          </div>
        </PortalSectionCard>
      ) : null}

      {!historyOnly && inbox && inbox.pending.length > 0 ? (
        <PortalSectionCard title={`Pendentes (${inbox.pending.length})`}>
          <div className="divide-y divide-slate-100">
            {inbox.pending.map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
                scope={scope}
                actionLabel="Iniciar"
                busy={busyId === item.id}
                onAction={() => void onStart(item)}
              />
            ))}
          </div>
        </PortalSectionCard>
      ) : null}

      {!historyOnly && inbox && inbox.available.length > 0 ? (
        <PortalSectionCard
          title={`Para distribuir (${inbox.available.length})`}
          description={
            scope === 'conferences'
              ? 'Conferências do pool que você pode assumir.'
              : 'Atividades do pool que você pode assumir.'
          }
        >
          <div className="divide-y divide-slate-100">
            {inbox.available.map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
                scope={scope}
                actionLabel="Assumir"
                busy={busyId === item.id}
                onAction={() => void onClaim(item)}
              />
            ))}
          </div>
        </PortalSectionCard>
      ) : null}

      {inbox && inbox.completed.length > 0 ? (
        <PortalSectionCard
          title={
            historyOnly
              ? `Realizados hoje (${inbox.completed.length})`
              : `Realizados (${inbox.completed.length})`
          }
        >
          <div className="divide-y divide-slate-100">
            {inbox.completed.map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
                scope={scope}
                actionLabel={item.type === 'inventory_conference' ? 'Ok' : 'Ver'}
                busy={false}
                muted
                onAction={() => {
                  if (item.type === 'inventory_conference') return
                  goActivity(item, { view: true })
                }}
              />
            ))}
          </div>
        </PortalSectionCard>
      ) : null}

      {!loading &&
      !historyOnly &&
      inbox &&
      inbox.summary.inProgress +
        inbox.summary.pending +
        inbox.summary.available +
        inbox.summary.completed >
        0 ? (
        <p className="flex items-center gap-1.5 px-1 text-xs text-slate-500">
          <CheckSquare className="size-3.5" />
          Concluídas permanecem em Realizados no histórico do dia.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void load()}
        className="flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 shadow-sm"
      >
        Atualizar
        <ChevronRight className="size-4 text-slate-400" />
      </button>
    </section>
  )
}

export function ConferencesPage() {
  return <ActivitiesPage scope="conferences" />
}
