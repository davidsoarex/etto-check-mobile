import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import { QtyStepperInput } from '@/features/activities/components/qty-stepper-input'
import {
  PackageCountInput,
  initialBreakdownFromLine,
} from '@/features/activities/components/package-count-input'
import {
  fetchActivityConference,
  finalizeActivityConference,
  patchActivityConferenceLine,
  type ConferenceActivityPayload,
  type ConferenceLineDto,
} from '@/features/activities/api/activities-api'
import {
  formatQtyDraft,
  normalizeQtyForUnit,
  qtyStepForUnit,
} from '@/features/activities/lib/qty-helpers'
import {
  computeTotalFromPackages,
  lineAllowsLoose,
  toApiBreakdown,
  type PackageBreakdown,
} from '@/features/activities/lib/package-count'

function isPackageLine(line: ConferenceLineDto): boolean {
  return line.countMode === 'package_count' && Array.isArray(line.packages) && line.packages.length > 0
}

export function ConferenceActivityPage() {
  const { activityId: activityIdParam } = useParams()
  const activityId = Number(activityIdParam)
  const navigate = useNavigate()
  const { portalToken } = useAuth()

  const [payload, setPayload] = useState<ConferenceActivityPayload | null>(null)
  const [draft, setDraft] = useState<Record<number, string>>({})
  const [committed, setCommitted] = useState<Record<number, string>>({})
  const [pkgDraft, setPkgDraft] = useState<Record<number, PackageBreakdown>>({})
  const [pkgCommitted, setPkgCommitted] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [savingLineIds, setSavingLineIds] = useState<Record<number, boolean>>({})
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const draftRef = useRef(draft)
  const committedRef = useRef(committed)
  const pkgDraftRef = useRef(pkgDraft)
  const pkgCommittedRef = useRef(pkgCommitted)
  const payloadRef = useRef(payload)
  const savingRef = useRef<Record<number, boolean>>({})
  draftRef.current = draft
  committedRef.current = committed
  pkgDraftRef.current = pkgDraft
  pkgCommittedRef.current = pkgCommitted
  payloadRef.current = payload

  const applyPayload = useCallback((next: ConferenceActivityPayload) => {
    setPayload(next)
    const nextDraft: Record<number, string> = {}
    const nextCommitted: Record<number, string> = {}
    const nextPkg: Record<number, PackageBreakdown> = {}
    const nextPkgCommitted: Record<number, string> = {}
    for (const line of next.lines) {
      const formatted = formatQtyDraft(line.contado)
      nextDraft[line.id] = formatted
      nextCommitted[line.id] = formatted
      if (isPackageLine(line) && line.packages) {
        const bd = initialBreakdownFromLine(
          line.packages,
          line.contado,
          lineAllowsLoose(line),
        )
        nextPkg[line.id] = bd
        nextPkgCommitted[line.id] = formatQtyDraft(computeTotalFromPackages(bd))
      }
    }
    setDraft(nextDraft)
    setCommitted(nextCommitted)
    setPkgDraft(nextPkg)
    setPkgCommitted(nextPkgCommitted)
  }, [])

  const load = useCallback(async () => {
    if (!portalToken || !Number.isFinite(activityId) || activityId < 1) return
    setIsLoading(true)
    setError(null)
    try {
      const next = await fetchActivityConference(portalToken, activityId)
      applyPayload(next)
    } catch (e) {
      setPayload(null)
      setError(e instanceof Error ? e.message : 'Erro ao abrir conferência.')
    } finally {
      setIsLoading(false)
    }
  }, [portalToken, activityId, applyPayload])

  useEffect(() => {
    void load()
  }, [load])

  const applyLineUpdate = useCallback((updated: ConferenceLineDto) => {
    const formatted = formatQtyDraft(updated.contado)
    setPayload((prev) => {
      if (!prev) return prev
      const lines = prev.lines.map((line) => (line.id === updated.id ? { ...line, ...updated } : line))
      const counted = lines.filter((line) => line.contado != null).length
      return {
        ...prev,
        lines,
        progress: { counted, total: lines.length },
      }
    })
    setDraft((prev) => ({ ...prev, [updated.id]: formatted }))
    setCommitted((prev) => ({ ...prev, [updated.id]: formatted }))
    if (isPackageLine(updated) && updated.packages) {
      const bd = initialBreakdownFromLine(
        updated.packages,
        updated.contado,
        lineAllowsLoose(updated),
      )
      setPkgDraft((prev) => ({ ...prev, [updated.id]: bd }))
      setPkgCommitted((prev) => ({
        ...prev,
        [updated.id]: formatQtyDraft(computeTotalFromPackages(bd)),
      }))
    }
  }, [])

  const saveLine = useCallback(
    async (lineId: number, opts?: { quiet?: boolean }) => {
      if (!portalToken) return false
      const session = payloadRef.current
      if (!session || session.session.status !== 'aberta') return false
      if (savingRef.current[lineId]) return false

      const line = session.lines.find((row) => row.id === lineId)
      if (!line) return false

      let qty: number | null = null
      let packageBreakdown:
        | { packages: Array<{ quantity: number; count: number }>; loose: number }
        | undefined

      if (isPackageLine(line) && line.packages) {
        const bd = pkgDraftRef.current[lineId]
        if (!bd) return false
        qty = computeTotalFromPackages(bd)
        if (qty <= 0 && line.contado == null) {
          // permitir gravar 0? User might need to mark counted as 0. Allow 0 as valid count.
        }
        const formatted = formatQtyDraft(qty)
        if (formatted === (pkgCommittedRef.current[lineId] ?? '') && line.contado != null) {
          return true
        }
        packageBreakdown = toApiBreakdown(
          line.packages,
          bd,
          lineAllowsLoose(line),
        )
      } else {
        const raw = (draftRef.current[lineId] ?? '').trim()
        if (raw === '') return false
        qty = normalizeQtyForUnit(raw, line.unit)
        if (qty == null) {
          if (!opts?.quiet) setError('Informe a quantidade contada.')
          return false
        }
        const formatted = formatQtyDraft(qty)
        if (formatted === (committedRef.current[lineId] ?? '')) return true
      }

      if (qty == null) return false

      savingRef.current = { ...savingRef.current, [lineId]: true }
      setSavingLineIds((prev) => ({ ...prev, [lineId]: true }))
      if (!opts?.quiet) {
        setError(null)
        setInfo(null)
      }
      try {
        const updated = await patchActivityConferenceLine(
          portalToken,
          lineId,
          qty,
          packageBreakdown ?? null,
        )
        applyLineUpdate({ ...line, ...updated })
        return true
      } catch (e) {
        if (!opts?.quiet) {
          setError(e instanceof Error ? e.message : 'Erro ao gravar contagem.')
        }
        return false
      } finally {
        savingRef.current = { ...savingRef.current, [lineId]: false }
        setSavingLineIds((prev) => ({ ...prev, [lineId]: false }))
      }
    },
    [portalToken, applyLineUpdate],
  )

  const progress = payload?.progress ?? { counted: 0, total: 0 }
  const remaining = Math.max(0, progress.total - progress.counted)
  const canFinalize = progress.total > 0 && remaining === 0
  const sessionClosed = payload != null && payload.session.status !== 'aberta'

  const finalize = async () => {
    if (!portalToken || !payload) return
    setFinalizing(true)
    setError(null)
    setInfo(null)
    try {
      for (const line of payload.lines) {
        if (line.contado == null) {
          await saveLine(line.id, { quiet: true })
        }
      }
      const current = payloadRef.current
      if (!current) return
      const countedNow = current.lines.filter((l) => l.contado != null).length
      const left = current.lines.length - countedNow
      if (left > 0) {
        setError(left === 1 ? 'Falta conferir 1 item.' : `Falta conferir ${left} itens.`)
        return
      }
      await finalizeActivityConference(portalToken, current.session.id)
      setInfo('Conferência concluída.')
      setTimeout(() => navigate('/conferencias'), 600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao concluir conferência.')
    } finally {
      setFinalizing(false)
    }
  }

  if (!Number.isFinite(activityId) || activityId < 1) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center">
        <p className="text-sm text-slate-800">Atividade inválida.</p>
        <Link
          to="/conferencias"
          className="mt-2 inline-flex items-center justify-center gap-1 text-sm font-medium text-brand-deep"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Voltar às conferências
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <Link
          to="/conferencias"
          className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-deep"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          Conferências
        </Link>
        <p className="text-xs font-semibold tabular-nums text-slate-700">
          {progress.counted}/{progress.total}
        </p>
      </div>

      <PortalSectionCard
        title={payload?.session.conferenceListName ?? payload?.occurrence.titleSnapshot ?? 'Conferência'}
        description={
          sessionClosed
            ? 'Sessão encerrada.'
            : 'Contagem cega — sem saldo. Embalagens quando configuradas; grava ao soltar +/−.'
        }
      >
        {payload?.session.stockLocationName ? (
          <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
            Local:{' '}
            <span className="font-medium text-slate-900">{payload.session.stockLocationName}</span>
          </div>
        ) : null}

        {isLoading && <p className="px-4 py-5 text-sm text-slate-600">Carregando…</p>}
        {error && <p className="px-4 py-3 text-sm text-rose-600">{error}</p>}
        {info && <p className="px-4 py-3 text-sm text-emerald-700">{info}</p>}

        {!isLoading && payload && (
          <div className="divide-y divide-slate-100">
            {payload.lines.map((line) => {
              const step = qtyStepForUnit(line.unit)
              const saving = Boolean(savingLineIds[line.id])
              const packageMode = isPackageLine(line)
              const draftQty = packageMode
                ? computeTotalFromPackages(
                    pkgDraft[line.id] ??
                      initialBreakdownFromLine(
                        line.packages ?? [],
                        null,
                        lineAllowsLoose(line),
                      ),
                  )
                : normalizeQtyForUnit(draft[line.id] ?? '', line.unit)
              const dirty = packageMode
                ? formatQtyDraft(draftQty) !== (pkgCommitted[line.id] ?? '')
                : draftQty != null && formatQtyDraft(draftQty) !== (committed[line.id] ?? '')

              const statusBadge = saving ? (
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  Gravando…
                </span>
              ) : line.contado != null && !dirty ? (
                <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Contado
                </span>
              ) : dirty ? (
                <span className="shrink-0 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-900">
                  Alterado
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                  Pendente
                </span>
              )

              const lineHeader = (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-snug text-slate-900">{line.itemName}</p>
                    {line.unit ? (
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">{line.unit}</p>
                    ) : null}
                  </div>
                  {statusBadge}
                </div>
              )

              return (
                <div key={line.id} className="px-4 py-3">
                  {!sessionClosed ? (
                    packageMode && line.packages ? (
                      <PackageCountInput
                        packages={line.packages}
                        unit={line.unit}
                        allowLoose={lineAllowsLoose(line)}
                        header={lineHeader}
                        value={
                          pkgDraft[line.id] ??
                          initialBreakdownFromLine(
                            line.packages,
                            line.contado,
                            lineAllowsLoose(line),
                          )
                        }
                        onChange={(next) =>
                          setPkgDraft((prev) => ({
                            ...prev,
                            [line.id]: next,
                          }))
                        }
                        onCommit={() => {
                          void saveLine(line.id)
                        }}
                        disabled={saving || finalizing}
                      />
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
                        <div className="border-b border-slate-200/80 bg-white/70 px-3 py-2.5">
                          {lineHeader}
                        </div>
                        <div className="space-y-1.5 px-3 py-2.5">
                          <QtyStepperInput
                            value={draft[line.id] ?? ''}
                            onChange={(next) =>
                              setDraft((prev) => ({
                                ...prev,
                                [line.id]: next,
                              }))
                            }
                            onCommit={() => {
                              void saveLine(line.id)
                            }}
                            measureUnit={line.unit}
                            disabled={saving || finalizing}
                          />
                          {step < 1 ? (
                            <p className="text-right text-[10px] text-slate-500">Passo 0,1</p>
                          ) : null}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      {lineHeader}
                      <p className="mt-2 text-sm tabular-nums text-slate-800">
                        Contado: {formatQtyDraft(line.contado) || '—'}
                        {line.unit ? ` ${line.unit}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!isLoading && payload && !sessionClosed ? (
          <div className="space-y-2 border-t border-slate-100 px-4 py-4">
            {!canFinalize ? (
              <p className="text-xs text-amber-900">
                {remaining === 1
                  ? 'Falta conferir 1 item.'
                  : `Falta conferir ${remaining} itens.`}
              </p>
            ) : (
              <p className="text-xs text-slate-600">Todos os itens contados. Pode concluir.</p>
            )}
            <button
              type="button"
              className="min-h-11 w-full rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!canFinalize || finalizing}
              onClick={() => void finalize()}
            >
              {finalizing ? 'Concluindo…' : 'Concluir conferência'}
            </button>
          </div>
        ) : null}
      </PortalSectionCard>
    </section>
  )
}
