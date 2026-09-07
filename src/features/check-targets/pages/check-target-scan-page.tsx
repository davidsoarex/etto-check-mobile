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
  resolveCheckTargetByToken,
  startOrResumeCheckExecution,
  updateCheckExecutionItem,
  uploadCheckExecutionEvidence,
  type PortalExecution,
  type PortalExecutionItem,
  type PortalResolveResponse,
} from '@/features/check-targets/api/check-targets-api'
import { useCheckTargetImagePreviews } from '@/features/check-targets/hooks/use-check-target-image-previews'

type Phase = 'target' | 'execution' | 'done'

function itemButtons(responseType: string): Array<{ result: string; label: string; actionTaken?: string }> {
  if (responseType === 'status') {
    return [
      { result: 'ok', label: 'OK' },
      { result: 'attention', label: 'Atenção' },
      { result: 'problem', label: 'Problema' },
    ]
  }
  if (responseType === 'action') {
    return [
      { result: 'no_action', label: 'Nenhuma ação necessária', actionTaken: 'none' },
      { result: 'action_taken', label: 'Abastecido', actionTaken: 'refilled' },
      { result: 'problem', label: 'Problema' },
    ]
  }
  return [
    { result: 'done', label: 'Concluído' },
    { result: 'problem', label: 'Problema' },
  ]
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
  const fileInputRef = useRef<HTMLInputElement>(null)
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
                    className={`h-11 rounded-xl text-sm font-semibold ${
                      choice.result === 'problem'
                        ? 'border border-rose-200 bg-rose-50 text-rose-800'
                        : 'bg-brand-cobalt text-white'
                    }`}
                  >
                    {savingItemId === item.id ? 'Salvando...' : choice.label}
                  </button>
                ))}
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
