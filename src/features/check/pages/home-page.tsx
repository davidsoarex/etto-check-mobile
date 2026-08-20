import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  History,
  ListTodo,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/context/use-auth'
import {
  fetchEcheckRoutines,
  fetchSupervisorPendingValidations,
  type EcheckRoutineSession,
} from '@/services/echeck-api'
import {
  fetchActivitiesInbox,
  type ActivitiesInboxResponse,
} from '@/features/activities/api/activities-api'
import {
  activityPath,
  filterInboxByScope,
} from '@/features/activities/lib/activity-inbox-scope'

function firstName(full: string | null | undefined): string {
  const raw = (full ?? '').trim()
  if (!raw) return 'colaborador'
  return raw.split(/\s+/)[0] ?? raw
}

function routineInProgress(session: EcheckRoutineSession): boolean {
  const status = session.submission.status
  return status !== 'pending_validation' && status !== 'approved' && status !== 'rejected'
}

type ShortcutTone = 'blue' | 'violet' | 'amber' | 'rose' | 'slate' | 'teal'

const TONE_CLASS: Record<ShortcutTone, string> = {
  blue: 'bg-sky-500/15 text-sky-800',
  violet: 'bg-violet-500/15 text-violet-800',
  amber: 'bg-amber-500/15 text-amber-900',
  rose: 'bg-rose-500/15 text-rose-800',
  slate: 'bg-slate-500/15 text-slate-800',
  teal: 'bg-teal-500/15 text-teal-800',
}

function ShortcutTile({
  to,
  title,
  subtitle,
  icon: Icon,
  tone,
  badge,
}: {
  to: string
  title: string
  subtitle: string
  icon: typeof ListTodo
  tone: ShortcutTone
  badge?: number
}) {
  return (
    <Link
      to={to}
      className="relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition active:scale-[0.98] active:bg-slate-50"
    >
      {badge != null && badge > 0 ? (
        <span className="absolute right-2 top-2 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
      <span className={`grid size-11 place-items-center rounded-2xl ${TONE_CLASS[tone]}`}>
        <Icon className="size-5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{subtitle}</p>
      </div>
    </Link>
  )
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'sky' | 'amber' | 'violet' | 'rose'
}) {
  const tones = {
    sky: 'bg-sky-50 text-sky-900 ring-sky-200',
    amber: 'bg-amber-50 text-amber-950 ring-amber-200',
    violet: 'bg-violet-50 text-violet-950 ring-violet-200',
    rose: 'bg-rose-50 text-rose-950 ring-rose-200',
  }
  return (
    <div className={`rounded-xl px-2.5 py-2 ring-1 ${tones[tone]}`}>
      <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
    </div>
  )
}

export function HomePage() {
  const { portalToken, collaboratorName, logout, canValidateSubmissions, hasRoutineAccess } =
    useAuth()
  const [sessions, setSessions] = useState<EcheckRoutineSession[]>([])
  const [inbox, setInbox] = useState<ActivitiesInboxResponse | null>(null)
  const [pendingValidationCount, setPendingValidationCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!portalToken) return
    setIsLoading(true)

    const routinesPromise = hasRoutineAccess
      ? fetchEcheckRoutines(portalToken).then((res) => res.data)
      : Promise.resolve([] as EcheckRoutineSession[])

    const validationsPromise = canValidateSubmissions
      ? fetchSupervisorPendingValidations(portalToken).then((res) => res.data.length)
      : Promise.resolve(0)

    const activitiesPromise = fetchActivitiesInbox(portalToken).catch(() => null)

    void Promise.all([routinesPromise, validationsPromise, activitiesPromise])
      .then(([routineData, pendingCount, activities]) => {
        setSessions(routineData)
        setPendingValidationCount(pendingCount)
        setInbox(activities)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar início.'))
      .finally(() => setIsLoading(false))
  }, [canValidateSubmissions, hasRoutineAccess, portalToken])

  const name = firstName(collaboratorName)
  const activitiesInbox = inbox ? filterInboxByScope(inbox, 'activities') : null
  const conferencesInbox = inbox ? filterInboxByScope(inbox, 'conferences') : null

  const activitiesOpen =
    (activitiesInbox?.summary.inProgress ?? 0) +
    (activitiesInbox?.summary.pending ?? 0) +
    (activitiesInbox?.summary.available ?? 0)
  const conferencesOpen =
    (conferencesInbox?.summary.inProgress ?? 0) +
    (conferencesInbox?.summary.pending ?? 0) +
    (conferencesInbox?.summary.available ?? 0)
  const activitiesInProgress = activitiesInbox?.summary.inProgress ?? 0
  const conferencesInProgress = conferencesInbox?.summary.inProgress ?? 0
  const routinesOpen = sessions.filter(routineInProgress).length

  const continueActivity = activitiesInbox?.inProgress?.[0] ?? null
  const continueConference = conferencesInbox?.inProgress?.[0] ?? null
  const continueRoutine = sessions.find(routineInProgress) ?? null

  const activityContinueHref = continueActivity ? activityPath(continueActivity) : null
  const conferenceContinueHref = continueConference ? activityPath(continueConference) : null

  return (
    <section className="space-y-4">
      {/* 1. Cabeçalho */}
      <header className="flex items-start justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight text-slate-900">Olá, {name}</p>
          <p className="mt-0.5 text-sm text-slate-500">Bom trabalho hoje</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="grid size-9 place-items-center rounded-full bg-brand-deep/10 text-brand-deep"
            aria-hidden
          >
            <User className="size-4" />
          </span>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm"
            aria-label="Sair"
            onClick={logout}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* 2. Resumo do dia */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Atividades" value={activitiesOpen} tone="sky" />
        <StatChip label="Conferências" value={conferencesOpen} tone="violet" />
        {canValidateSubmissions ? (
          <StatChip label="Validação" value={pendingValidationCount} tone="rose" />
        ) : null}
        {hasRoutineAccess ? (
          <StatChip label="Rotinas" value={routinesOpen} tone="amber" />
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {/* 3. Grade de atalhos */}
      <div>
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Atalhos
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <ShortcutTile
            to="/atividades"
            title="Atividades"
            subtitle="Checklists e tarefas do dia"
            icon={ClipboardList}
            tone="blue"
            badge={activitiesOpen}
          />
          <ShortcutTile
            to="/conferencias"
            title="Conferências"
            subtitle="Contagens de estoque do dia"
            icon={Boxes}
            tone="teal"
            badge={conferencesOpen}
          />
          {hasRoutineAccess ? (
            <ShortcutTile
              to="/rotinas"
              title="Rotinas"
              subtitle="Registre fotos das rotinas do dia"
              icon={Camera}
              tone="violet"
              badge={routinesOpen}
            />
          ) : null}
          {canValidateSubmissions ? (
            <ShortcutTile
              to="/validacao"
              title="Validação"
              subtitle="Valide registros enviados"
              icon={ShieldCheck}
              tone="amber"
              badge={pendingValidationCount}
            />
          ) : null}
          <ShortcutTile
            to="/relatar-problema"
            title="Relatar problema"
            subtitle="Equipamento, falta de item, local"
            icon={AlertTriangle}
            tone="rose"
          />
          <ShortcutTile
            to="/meus-problemas"
            title="Meus problemas"
            subtitle="Acompanhar status dos relatos"
            icon={ClipboardList}
            tone="slate"
          />
          <ShortcutTile
            to="/atividades?view=historico"
            title="Histórico"
            subtitle="Atividades concluídas hoje"
            icon={History}
            tone="slate"
          />
        </div>
      </div>

      {/* 4. Continuar de onde parou */}
      <div>
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Continuar
        </p>
        <div className="space-y-2">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 shadow-sm">
              Carregando…
            </div>
          ) : null}

          {!isLoading && continueConference && conferenceContinueHref ? (
            <Link
              to={conferenceContinueHref}
              className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50/80 px-3.5 py-3 shadow-sm transition active:bg-teal-100"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-500/15 text-teal-800">
                <Boxes className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-teal-800">
                  Conferência em andamento
                </p>
                <p className="truncate text-sm font-bold text-slate-900">
                  {continueConference.titleSnapshot}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {[
                    continueConference.stockLocationName?.trim() || null,
                    'Em andamento',
                    continueConference.progress && continueConference.progress.total > 0
                      ? `${continueConference.progress.counted}/${continueConference.progress.total}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-teal-700 px-2.5 py-1.5 text-[11px] font-bold text-white">
                Continuar
              </span>
            </Link>
          ) : null}

          {!isLoading && continueActivity && activityContinueHref ? (
            <Link
              to={activityContinueHref}
              className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 px-3.5 py-3 shadow-sm transition active:bg-sky-100"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-800">
                <ListTodo className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">
                  Continuar agora
                </p>
                <p className="truncate text-sm font-bold text-slate-900">
                  {continueActivity.titleSnapshot}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {continueActivity.typeLabel ?? 'Atividade'} · Em andamento
                  {continueActivity.progress && continueActivity.progress.total > 0
                    ? ` · ${continueActivity.progress.counted}/${continueActivity.progress.total}`
                    : ''}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-sky-700" />
            </Link>
          ) : null}

          {!isLoading && continueRoutine ? (
            <Link
              to={`/rotinas/${continueRoutine.routine.id}`}
              className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 px-3.5 py-3 shadow-sm transition active:bg-violet-100"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-800">
                <Camera className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {continueRoutine.routine.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {continueRoutine.submission.completedCount}/
                  {continueRoutine.submission.requiredCount} fotos · Em andamento
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-violet-700 px-2.5 py-1.5 text-[11px] font-bold text-white">
                Continuar
              </span>
            </Link>
          ) : null}

          {!isLoading && activitiesOpen > 0 ? (
            <Link
              to="/atividades"
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition active:bg-slate-50"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <Clock className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">Atividades de hoje</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {activitiesInProgress} em andamento ·{' '}
                  {(activitiesInbox?.summary.pending ?? 0) +
                    (activitiesInbox?.summary.available ?? 0)}{' '}
                  pendentes
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-slate-300" />
            </Link>
          ) : null}

          {!isLoading && conferencesOpen > 0 ? (
            <Link
              to="/conferencias"
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition active:bg-slate-50"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-500/10 text-teal-800">
                <Boxes className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">Conferências de hoje</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {conferencesInProgress} em andamento ·{' '}
                  {(conferencesInbox?.summary.pending ?? 0) +
                    (conferencesInbox?.summary.available ?? 0)}{' '}
                  pendentes
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-slate-300" />
            </Link>
          ) : null}

          {!isLoading && canValidateSubmissions ? (
            <Link
              to="/validacao"
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition active:bg-slate-50"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-800">
                <CheckCircle2 className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">Fila de validação</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {pendingValidationCount > 0
                    ? `${pendingValidationCount} registro(s) aguardando`
                    : 'Nenhum registro pendente'}
                </p>
              </div>
              {pendingValidationCount > 0 ? (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                  {pendingValidationCount}
                </span>
              ) : (
                <ChevronRight className="size-4 shrink-0 text-slate-300" />
              )}
            </Link>
          ) : null}

          {!isLoading &&
          !continueActivity &&
          !continueConference &&
          !continueRoutine &&
          activitiesOpen === 0 &&
          conferencesOpen === 0 &&
          !(canValidateSubmissions && pendingValidationCount > 0) ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-center text-sm text-slate-500">
              Nada em andamento agora. Use os atalhos acima.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
