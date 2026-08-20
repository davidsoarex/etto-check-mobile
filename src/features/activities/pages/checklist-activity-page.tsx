import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Camera, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import {
  completeActivityChecklist,
  fetchActivityAttachmentBlob,
  fetchActivityChecklist,
  uploadActivityAttachment,
  type ChecklistActivityPayload,
  type CompletionResult,
} from '@/features/activities/api/activities-api'

export function ChecklistActivityPage() {
  const { activityId: activityIdParam } = useParams()
  const activityId = Number(activityIdParam)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { portalToken } = useAuth()

  const [payload, setPayload] = useState<ChecklistActivityPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [step, setStep] = useState<'detail' | 'finish'>('detail')
  const [result, setResult] = useState<CompletionResult | null>(null)
  const [justification, setJustification] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<number, string>>({})
  const captureInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!portalToken || !Number.isFinite(activityId) || activityId < 1) return
    setIsLoading(true)
    setError(null)
    try {
      const next = await fetchActivityChecklist(portalToken, activityId)
      setPayload(next)
      setConfirmed(false)
      if (next.occurrence.status === 'completed' || searchParams.get('view') === '1') {
        setStep('detail')
      }
    } catch (e) {
      setPayload(null)
      setError(e instanceof Error ? e.message : 'Erro ao abrir checklist.')
    } finally {
      setIsLoading(false)
    }
  }, [portalToken, activityId, searchParams])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!portalToken || !payload?.attachments?.length) return
    let cancelled = false
    const urls: string[] = []
    void (async () => {
      const next: Record<number, string> = {}
      for (const att of payload.attachments) {
        try {
          const blob = await fetchActivityAttachmentBlob(portalToken, att.id)
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          urls.push(url)
          next[att.id] = url
        } catch {
          // ignore preview failures
        }
      }
      if (!cancelled) setPreviews(next)
    })()
    return () => {
      cancelled = true
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [portalToken, payload?.attachments])

  const done = payload?.occurrence.status === 'completed'
  const evidenceMode = payload?.execution.evidenceMode ?? 'optional'
  const attachmentCount = payload?.attachments?.length ?? 0

  const canSubmitFinish =
    result != null &&
    (result === 'complete' || justification.trim().length > 0) &&
    (evidenceMode !== 'required' || attachmentCount > 0) &&
    (!payload?.execution.exigeConfirmacao || confirmed)

  const onPickFile = async (file: File | undefined) => {
    if (!file || !portalToken || done) return
    setUploading(true)
    setError(null)
    try {
      const att = await uploadActivityAttachment(portalToken, activityId, file)
      setPayload((prev) =>
        prev ? { ...prev, attachments: [...(prev.attachments ?? []), att] } : prev,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar foto.')
    } finally {
      setUploading(false)
    }
  }

  const onComplete = async () => {
    if (!portalToken || !canSubmitFinish || !result) return
    setCompleting(true)
    setError(null)
    try {
      const next = await completeActivityChecklist(portalToken, activityId, {
        completionResult: result,
        completionJustification: justification.trim() || null,
      })
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              occurrence: { ...prev.occurrence, ...next.occurrence },
              execution: { ...prev.execution, status: next.execution.status },
            }
          : prev,
      )
      navigate('/atividades', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao concluir checklist.')
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

  const resultLabel =
    payload?.occurrence.completionResult === 'partial'
      ? 'Concluída parcialmente'
      : payload?.occurrence.completionResult === 'complete'
        ? 'Concluída totalmente'
        : 'Concluída'

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-deep"
          onClick={() => (step === 'finish' && !done ? setStep('detail') : navigate('/atividades'))}
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          {step === 'finish' && !done ? 'Voltar' : 'Atividades'}
        </button>
        {!done ? (
          <button
            type="button"
            className="text-xs font-semibold text-amber-800"
            onClick={() =>
              navigate(`/atividades/${activityId}/problema`, {
                state: { titleHint: payload?.execution.title },
              })
            }
          >
            Relatar problema
          </button>
        ) : null}
      </div>

      <PortalSectionCard
        title={payload?.execution.title ?? payload?.occurrence.titleSnapshot ?? 'Checklist'}
        description={
          done
            ? resultLabel
            : step === 'finish'
              ? 'Como esta rotina foi concluída?'
              : 'Execute a rotina e depois informe o resultado.'
        }
      >
        {isLoading && <p className="px-4 py-5 text-sm text-slate-600">Carregando…</p>}
        {error && <p className="px-4 py-3 text-sm text-rose-600">{error}</p>}

        {!isLoading && payload && step === 'detail' ? (
          <div className="space-y-4 px-4 py-4">
            {payload.execution.description ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {payload.execution.description}
              </p>
            ) : (
              <p className="text-sm text-slate-600">Sem descrição adicional.</p>
            )}

            {done && payload.occurrence.completionJustification ? (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Justificativa
                </p>
                <p className="mt-1 whitespace-pre-wrap">{payload.occurrence.completionJustification}</p>
              </div>
            ) : null}

            {attachmentCount > 0 ? (
              <div className="flex flex-wrap gap-2">
                {payload.attachments.map((att) =>
                  previews[att.id] ? (
                    <img
                      key={att.id}
                      src={previews[att.id]}
                      alt={att.fileName ?? 'Evidência'}
                      className="size-20 rounded-lg object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <div
                      key={att.id}
                      className="grid size-20 place-items-center rounded-lg bg-slate-100 text-[10px] text-slate-500"
                    >
                      Foto
                    </div>
                  ),
                )}
              </div>
            ) : null}

            {!done ? (
              <button
                type="button"
                className="min-h-11 w-full rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white"
                onClick={() => setStep('finish')}
              >
                Concluir…
              </button>
            ) : (
              <p className="text-sm font-semibold text-emerald-700">{resultLabel}.</p>
            )}
          </div>
        ) : null}

        {!isLoading && payload && step === 'finish' && !done ? (
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-2">
              <button
                type="button"
                className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ${
                  result === 'complete'
                    ? 'bg-emerald-600 text-white ring-emerald-700'
                    : 'bg-white text-slate-800 ring-slate-300'
                }`}
                onClick={() => setResult('complete')}
              >
                Concluída totalmente
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ${
                  result === 'partial'
                    ? 'bg-amber-500 text-white ring-amber-600'
                    : 'bg-white text-slate-800 ring-slate-300'
                }`}
                onClick={() => setResult('partial')}
              >
                Concluída parcialmente
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-600">
                {result === 'partial' ? 'Justificativa (obrigatória)' : 'Observação (opcional)'}
              </span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder={
                  result === 'partial'
                    ? 'Explique o que ficou pendente…'
                    : 'Observação opcional…'
                }
              />
            </label>

            {evidenceMode !== 'none' ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">
                  Foto {evidenceMode === 'required' ? '(obrigatória)' : '(opcional)'}
                </p>
                <button
                  type="button"
                  disabled={uploading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={() => captureInputRef.current?.click()}
                >
                  <Camera className="size-3.5" />
                  Tirar foto agora
                </button>
                {attachmentCount > 0 ? (
                  <p className="text-xs text-emerald-700">{attachmentCount} foto(s) anexada(s).</p>
                ) : null}
                {uploading ? <p className="text-xs text-slate-500">Enviando…</p> : null}
              </div>
            ) : null}

            {payload.execution.exigeConfirmacao ? (
              <label className="flex items-start gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-slate-300"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>Confirmo que executei esta checklist.</span>
              </label>
            ) : null}

            <button
              type="button"
              className="min-h-11 w-full rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!canSubmitFinish || completing || uploading}
              onClick={() => void onComplete()}
            >
              {completing ? 'Concluindo…' : 'Confirmar conclusão'}
            </button>
          </div>
        ) : null}
      </PortalSectionCard>

      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          void onPickFile(file)
        }}
      />
    </section>
  )
}
