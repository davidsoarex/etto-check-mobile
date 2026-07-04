import { Link } from 'react-router-dom'

import { Camera, ChevronRight, ClipboardCheck, LogOut } from 'lucide-react'

import { useAuth } from '@/features/auth/context/use-auth'

import { useEffect, useState } from 'react'

import {

  fetchEcheckRoutines,

  fetchSupervisorPendingValidations,

  type EcheckRoutineSession,

} from '@/services/echeck-api'

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

  const { portalToken, collaboratorName, logout, canValidateSubmissions, hasRoutineAccess } = useAuth()

  const [sessions, setSessions] = useState<EcheckRoutineSession[]>([])

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



    void Promise.all([routinesPromise, validationsPromise])

      .then(([routineData, pendingCount]) => {

        setSessions(routineData)

        setPendingValidationCount(pendingCount)

        setError(null)

      })

      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar início.'))

      .finally(() => setIsLoading(false))

  }, [canValidateSubmissions, hasRoutineAccess, portalToken])



  const homeDescription = canValidateSubmissions

    ? hasRoutineAccess

      ? 'Registre fotos das suas rotinas ou valide registros de outros colaboradores.'

      : 'Valide os registros fotográficos enviados pelos colaboradores.'

    : 'Registre as fotos das rotinas atribuídas a você.'



  return (

    <section className="space-y-3">

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">

        <div className="flex items-start justify-between gap-3">

          <div>

            <p className="text-xs uppercase tracking-wide text-slate-500">Olá</p>

            <h1 className="text-lg font-bold text-slate-900">{collaboratorName}</h1>

            <p className="mt-1 text-xs text-slate-600">{homeDescription}</p>

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



      {canValidateSubmissions ? (

        <PortalSectionCard

          title="Validação de registros"

          description="Revise fotos enviadas por colaboradores e aprove ou rejeite."

        >

          <Link

            to="/validacao"

            className="flex items-center gap-3 px-4 py-3 transition active:bg-slate-50"

          >

            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-700">

              <ClipboardCheck className="size-4" />

            </span>

            <div className="min-w-0 flex-1">

              <p className="text-sm font-semibold text-slate-900">Fila de validação</p>

              <p className="mt-0.5 text-xs text-slate-500">

                {pendingValidationCount > 0

                  ? `${pendingValidationCount} registro(s) aguardando`

                  : 'Nenhum registro pendente no momento'}

              </p>

            </div>

            {pendingValidationCount > 0 ? (

              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-950">

                {pendingValidationCount}

              </span>

            ) : null}

            <ChevronRight className="size-4 shrink-0 text-slate-300" />

          </Link>

        </PortalSectionCard>

      ) : null}



      {hasRoutineAccess ? (

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

      ) : null}



      {!hasRoutineAccess && !canValidateSubmissions && !isLoading ? (

        <p className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600 shadow-sm">

          Nenhuma rotina ou permissão de validação disponível para sua conta.

        </p>

      ) : null}

    </section>

  )

}


