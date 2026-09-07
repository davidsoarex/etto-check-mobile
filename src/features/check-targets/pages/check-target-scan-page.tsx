import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Camera, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import { compressEcheckPhotoForUpload } from '@/lib/compress-echeck-photo'
import {
  cancelCheckExecution,
  completeCheckExecution,
  fetchCheckExecution,
  formatLastCompleted,
  kindLabel,
  reportExecutionIssue,
  reportExecutionItemIssue,
  resolveCheckTargetByToken,
  startOrResumeCheckExecution,
  updateCheckExecutionItem,
  uploadCheckExecutionEvidence,
  uploadOperationalIssuePhoto,
  type PortalExecution,
  type PortalExecutionItem,
  type PortalResolveResponse,
} from '@/features/check-targets/api/check-targets-api'
import { useCheckTargetImagePreviews } from '@/features/check-targets/hooks/use-check-target-image-previews'
import {
  OPERATIONAL_ISSUE_IMPACTS,
  type OperationalIssueImpact,
} from '@/features/activities/api/activities-api'

type Phase = 'target' | 'execution' | 'done'

function itemButtons(responseType: string): Array<{ result: string; label: string; actionTaken?: string }> {
  if (responseType === 'status') {
    return [
      { result: 'ok', label: 'OK' },
      { result: 'attention', label: 'Atenção' },
    ]
  }
  if (responseType === 'action') {
    return [
      { result: 'no_action', label: 'Não precisou agir', actionTaken: 'none' },
      { result: 'action_taken', label: 'Abastecido', actionTaken: 'refilled' },
      { result: 'action_taken', label: 'Esvaziado', actionTaken: 'emptied' },
    ]
  }
  return [{ result: 'done', label: 'Concluído' }]
}

function itemDone(item: PortalExecutionItem): boolean {
  return Boolean(item.result?.trim())
}

export function CheckTargetScanPage() {
  const { token: qrToken } = useParams<{ token: string }>()
  const { portalToken } = useAuth()
  const [phase, setPhase] = useState<Phase>('target')
  const [resolved, setResolved] = useState<PortalResolveResponse | null>(null)
  const [execution, setExecution] = useState<PortalExecution | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [savingItemId, setSavingItemId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [issueMode, setIssueMode] = useState<'item' | 'target' | null>(null)
  const [issueDescription, setIssueDescription] = useState('')
  const [issueImpact, setIssueImpact] = useState<OperationalIssueImpact>('degraded')
  const [issuePhoto, setIssuePhoto] = useState<File | null>(null)
  const [issueSuccess, setIssueSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const issuePhotoInputRef = useRef<HTMLInputElement>(null)
  const pendingPhotoItemId = useRef<number | null>(null)

  const loadTarget = useCallback(() => {
    if (!portalToken || !qrToken) return
    setIsLoading(true)
    setError(null)
    void resolveCheckTargetByToken(portalToken, qrToken)
      .then(async (data) => {
        setResolved(data)
        if (data.inProgressExecutionId) {
          const exec = await fetchCheckExecution(portalToken, data.inProgressExecutionId)
          setExecution(exec)
          setPhase(exec.status === 'in_progress' ? 'execution' : 'target')
          const firstPending = exec.items.findIndex((i) => !itemDone(i))
          setActiveItemIndex(firstPending >= 0 ? firstPending : 0)
        } else {
          setExecution(null)
          setPhase('target')
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível abrir o alvo.'))
      .finally(() => setIsLoading(false))
  }, [portalToken, qrToken])

  useEffect(() => {
    loadTarget()
  }, [loadTarget])

  const previewKeys = useMemo(() => {
    const keys: Array<{ kind: 'ref' | 'evidence'; id: number }> = []
    const item = execution?.items[activeItemIndex]
    if (!item) return keys
    for (const ref of item.referenceAttachments ?? []) keys.push({ kind: 'ref', id: ref.id })
    for (const ev of item.evidences ?? []) keys.push({ kind: 'evidence', id: ev.id })
    return keys
  }, [execution, activeItemIndex])

  const { entryFor } = useCheckTargetImagePreviews(portalToken ?? undefined, previewKeys)

  async function handleStart() {
    if (!portalToken || !resolved || busy) return
    setBusy(true)
    setError(null)
    try {
      const exec = await startOrResumeCheckExecution(portalToken, resolved.target.id)
      setExecution(exec)
      setPhase(exec.status === 'completed' ? 'done' : 'execution')
      const firstPending = exec.items.findIndex((i) => !itemDone(i))
      setActiveItemIndex(firstPending >= 0 ? firstPending : 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao iniciar verificação.')
    } finally {
      setBusy(false)
    }
  }

  async function saveItemResult(
    item: PortalExecutionItem,
    choice: { result: string; actionTaken?: string },
  ) {
    if (!portalToken || !execution || busy) return
    if (item.requirePhotoSnapshot && (item.evidences?.length ?? 0) < 1) {
      setError('Foto obrigatória antes de concluir este item.')
      return
    }
    setSavingItemId(item.id)
    setError(null)
    try {
      const updated = await updateCheckExecutionItem(portalToken, execution.id, item.id, {
        result: choice.result,
        actionTaken: choice.actionTaken ?? null,
      })
      setExecution(updated)
      const next = updated.items.findIndex((i) => !itemDone(i))
      if (next >= 0) setActiveItemIndex(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar item.')
    } finally {
      setSavingItemId(null)
    }
  }

  function openCamera(itemId: number) {
    pendingPhotoItemId.current = itemId
    fileInputRef.current?.click()
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const itemId = pendingPhotoItemId.current
    event.target.value = ''
    if (!file || !itemId || !portalToken || !execution) return
    setSavingItemId(itemId)
    setError(null)
    try {
      const { file: compressed } = await compressEcheckPhotoForUpload(file)
      await uploadCheckExecutionEvidence(portalToken, execution.id, itemId, compressed)
      const refreshed = await fetchCheckExecution(portalToken, execution.id)
      setExecution(refreshed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no envio da foto.')
    } finally {
      setSavingItemId(null)
    }
  }

  async function handleComplete() {
    if (!portalToken || !execution || busy) return
    setBusy(true)
    setError(null)
    try {
      const done = await completeCheckExecution(portalToken, execution.id)
      setExecution(done)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível finalizar.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!portalToken || !execution || busy) return
    if (!window.confirm('Cancelar esta verificação?')) return
    setBusy(true)
    setError(null)
    try {
      const cancelled = await cancelCheckExecution(portalToken, execution.id)
      setExecution(cancelled)
      setPhase('target')
      setResolved((prev) =>
        prev ? { ...prev, inProgressExecutionId: null } : prev,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao cancelar.')
    } finally {
      setBusy(false)
    }
  }

  function openIssueForm(mode: 'item' | 'target') {
    setIssueMode(mode)
    setIssueDescription('')
    setIssueImpact('degraded')
    setIssuePhoto(null)
    setIssueSuccess(false)
    setError(null)
  }

  function closeIssueForm() {
    setIssueMode(null)
    setIssueDescription('')
    setIssueImpact('degraded')
    setIssuePhoto(null)
    setIssueSuccess(false)
  }

  async function submitIssue() {
    if (!portalToken || !execution || !issueMode || busy) return
    const description = issueDescription.trim()
    if (!description) {
      setError('Descreva o problema.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const issue =
        issueMode === 'item'
          ? await reportExecutionItemIssue(
              portalToken,
              execution.id,
              execution.items[activeItemIndex]!.id,
              { description, operationalImpact: issueImpact },
            )
          : await reportExecutionIssue(portalToken, execution.id, {
              description,
              operationalImpact: issueImpact,
            })
      if (issuePhoto) {
        const { file } = await compressEcheckPhotoForUpload(issuePhoto)
        await uploadOperationalIssuePhoto(portalToken, issue.id, file)
      }
      // Execução continua — não altera item/result.
      const refreshed = await fetchCheckExecution(portalToken, execution.id)
      setExecution(refreshed)
      setIssueSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar problema.')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando alvo...
      </div>
    )
  }

  if (error && !resolved) {
    return (
      <div className="space-y-3 py-6">
        <p className="text-sm text-rose-700">{error}</p>
        <Link to="/inicio" className="text-sm font-medium text-brand-cobalt underline">
          Voltar ao início
        </Link>
      </div>
    )
  }

  if (!resolved) return null

  const target = resolved.target
  const hasInProgress = Boolean(resolved.inProgressExecutionId || execution?.status === 'in_progress')

  if (phase === 'done' && execution) {
    return (
      <div className="space-y-4 py-2">
        <PortalSectionCard title={target.name} description={kindLabel(target.kind)}>
          <div className="space-y-3 px-4 py-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="text-sm font-semibold text-slate-900">Verificação concluída</p>
            <p className="text-xs text-slate-600">{execution.items.length} itens registrados</p>
            <Link
              to="/inicio"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-cobalt px-4 text-sm font-semibold text-white"
            >
              Voltar ao início
            </Link>
          </div>
        </PortalSectionCard>
      </div>
    )
  }

  if (phase === 'execution' && execution) {
    const items = execution.items
    const item = items[activeItemIndex]
    const allDone = items.every(itemDone)
    const canComplete = allDone

    if (issueMode) {
      const itemLabel =
        issueMode === 'item' ? item?.itemNameSnapshot ?? 'Item' : null
      return (
        <div className="space-y-3 py-1">
          <PortalSectionCard title="Relatar problema" description={target.name}>
            <div className="space-y-4 px-4 py-4">
              {itemLabel ? (
                <p className="text-sm font-medium text-slate-800">{itemLabel}</p>
              ) : (
                <p className="text-sm text-slate-600">Problema geral deste local</p>
              )}
              {error ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
              ) : null}
              {issueSuccess ? (
                <div className="space-y-3 text-center">
                  <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-900">Problema enviado</p>
                  <p className="text-xs text-slate-600">Você pode continuar a verificação.</p>
                  <button
                    type="button"
                    onClick={closeIssueForm}
                    className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-cobalt text-sm font-semibold text-white"
                  >
                    Voltar ao item
                  </button>
                </div>
              ) : (
                <>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-600">Descrição</span>
                    <textarea
                      className="min-h-[6rem] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                      placeholder="O que está errado?"
                    />
                  </label>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-slate-600">Impacto no trabalho</legend>
                    <div className="flex flex-wrap gap-2">
                      {OPERATIONAL_ISSUE_IMPACTS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                            issueImpact === opt.value
                              ? 'bg-brand-deep text-white ring-brand-deep'
                              : 'bg-white text-slate-800 ring-slate-300'
                          }`}
                          onClick={() => setIssueImpact(opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-600">Foto (opcional)</p>
                    <input
                      ref={issuePhotoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        e.target.value = ''
                        setIssuePhoto(f)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => issuePhotoInputRef.current?.click()}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm text-slate-700"
                    >
                      <Camera className="h-4 w-4" />
                      {issuePhoto ? 'Trocar foto' : 'Tirar foto'}
                    </button>
                    {issuePhoto ? (
                      <p className="mt-1 text-xs text-slate-500">{issuePhoto.name}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitIssue()}
                    className="flex h-12 w-full items-center justify-center rounded-xl bg-rose-600 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? 'Enviando...' : 'Enviar problema'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={closeIssueForm}
                    className="flex h-10 w-full items-center justify-center text-sm text-slate-500"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </PortalSectionCard>
        </div>
      )
    }

    return (
      <div className="space-y-3 py-1">
        <div className="px-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {target.name}
          </p>
          <p className="text-sm text-slate-600">
            Item {activeItemIndex + 1} de {items.length}
          </p>
        </div>

        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoChange}
        />

        {item ? (
          <PortalSectionCard
            title={item.itemNameSnapshot}
            description={item.instructionSnapshot ?? undefined}
          >
            <div className="space-y-4 px-4 py-4">
              {(item.referenceAttachments?.length ?? 0) > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Como deve ficar</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {item.referenceAttachments!.map((ref) => {
                      const preview = entryFor('ref', ref.id)
                      return (
                        <div
                          key={ref.id}
                          className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100"
                        >
                          {preview.url ? (
                            <img src={preview.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center text-[10px] text-slate-400">
                              ref
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Sua evidência</p>
                {item.requirePhotoSnapshot ? (
                  <p className="mb-2 text-xs font-semibold text-amber-700">📷 Foto obrigatória</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {(item.evidences ?? []).map((ev) => {
                    const preview = entryFor('evidence', ev.id)
                    return (
                      <div
                        key={ev.id}
                        className="h-20 w-20 overflow-hidden rounded-lg bg-slate-100"
                      >
                        {preview.url ? (
                          <img src={preview.url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    disabled={savingItemId === item.id}
                    onClick={() => openCamera(item.id)}
                    className="inline-flex h-20 min-w-[5rem] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 text-xs text-slate-700"
                  >
                    <Camera className="h-4 w-4" />
                    {item.requirePhotoSnapshot ? 'Tirar foto' : 'Adicionar foto'}
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                {itemButtons(item.responseTypeSnapshot).map((choice) => (
                  <button
                    key={choice.result + (choice.actionTaken ?? '')}
                    type="button"
                    disabled={savingItemId === item.id || busy}
                    onClick={() => void saveItemResult(item, choice)}
                    className="h-11 rounded-xl bg-brand-cobalt text-sm font-semibold text-white"
                  >
                    {savingItemId === item.id ? 'Salvando...' : choice.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openIssueForm('item')}
                  className="h-11 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-800"
                >
                  Problema
                </button>
              </div>

              {items.length > 1 ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={activeItemIndex <= 0}
                    onClick={() => setActiveItemIndex((i) => Math.max(0, i - 1))}
                    className="h-10 flex-1 rounded-xl border border-slate-200 text-sm"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={activeItemIndex >= items.length - 1}
                    onClick={() => setActiveItemIndex((i) => Math.min(items.length - 1, i + 1))}
                    className="h-10 flex-1 rounded-xl border border-slate-200 text-sm"
                  >
                    Próximo
                  </button>
                </div>
              ) : null}
            </div>
          </PortalSectionCard>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => openIssueForm('target')}
          className="flex h-10 w-full items-center justify-center text-sm font-medium text-rose-700"
        >
          Relatar problema neste local
        </button>

        <button
          type="button"
          disabled={!canComplete || busy}
          onClick={() => void handleComplete()}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Finalizando...' : 'Finalizar verificação'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCancel()}
          className="flex h-10 w-full items-center justify-center gap-1 text-sm text-slate-500"
        >
          <XCircle className="h-4 w-4" />
          Cancelar verificação
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 py-1">
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <PortalSectionCard title={target.name} description={kindLabel(target.kind)}>
        <div className="space-y-4 px-4 py-4">
          {target.code ? <p className="text-xs text-slate-500">Código: {target.code}</p> : null}
          <div>
            <p className="text-xs font-medium text-slate-500">Última verificação</p>
            <p className="text-sm text-slate-800">{formatLastCompleted(resolved.lastCompleted)}</p>
          </div>
          <p className="text-sm font-medium text-slate-900">
            {target.activeItemCount} {target.activeItemCount === 1 ? 'item' : 'itens'} para verificar
          </p>
          <button
            type="button"
            disabled={busy || target.activeItemCount === 0}
            onClick={() => void handleStart()}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-cobalt text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy
              ? 'Abrindo...'
              : hasInProgress
                ? 'Continuar verificação'
                : 'Iniciar verificação'}
          </button>
        </div>
      </PortalSectionCard>
    </div>
  )
}
