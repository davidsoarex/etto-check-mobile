import { Link, Navigate, useParams } from 'react-router-dom'
import { Camera, ChevronLeft, Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PhotoLightbox } from '@/components/photo-lightbox'
import { PortalSectionCard } from '@/components/portal-section-card'
import { compressEcheckPhotoForUpload } from '@/lib/compress-echeck-photo'
import {
  deleteManagedItemReference,
  fetchManagedCheckTarget,
  kindLabel,
  uploadManagedItemReference,
  type PortalCheckTarget,
} from '@/features/check-targets/api/check-targets-api'
import { useCheckTargetImagePreviews } from '@/features/check-targets/hooks/use-check-target-image-previews'

type CameraIntent = { itemId: number; replaceAttachmentId?: number }

export function ManagedTargetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const targetId = Number(id)
  const { portalToken, canManageCheckTargets } = useAuth()
  const [target, setTarget] = useState<PortalCheckTarget | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraIntent = useRef<CameraIntent | null>(null)

  const load = useCallback(() => {
    if (!portalToken || !Number.isFinite(targetId) || targetId <= 0) return
    setIsLoading(true)
    void fetchManagedCheckTarget(portalToken, targetId)
      .then((data) => {
        setTarget(data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível abrir o local.'))
      .finally(() => setIsLoading(false))
  }, [portalToken, targetId])

  useEffect(() => {
    load()
  }, [load])

  const previewKeys = useMemo(() => {
    const keys: Array<{ kind: 'ref' | 'evidence'; id: number }> = []
    for (const item of target?.items ?? []) {
      for (const ref of item.referenceAttachments) keys.push({ kind: 'ref', id: ref.id })
    }
    return keys
  }, [target])

  const { entryFor } = useCheckTargetImagePreviews(portalToken ?? undefined, previewKeys)

  function openCamera(intent: CameraIntent) {
    cameraIntent.current = intent
    fileInputRef.current?.click()
  }

  async function handlePhotoSelected(file: File | null) {
    const intent = cameraIntent.current
    cameraIntent.current = null
    if (!file || !intent || !portalToken) return
    const key = `item:${intent.itemId}`
    setBusyKey(key)
    setError(null)
    try {
      const { file: compressed } = await compressEcheckPhotoForUpload(file)
      await uploadManagedItemReference(portalToken, intent.itemId, compressed)
      if (intent.replaceAttachmentId) {
        await deleteManagedItemReference(portalToken, intent.replaceAttachmentId)
      }
      const refreshed = await fetchManagedCheckTarget(portalToken, targetId)
      setTarget(refreshed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar a foto de referência.')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleDelete(attachmentId: number) {
    if (!portalToken) return
    const key = `ref:${attachmentId}`
    setBusyKey(key)
    setError(null)
    try {
      await deleteManagedItemReference(portalToken, attachmentId)
      const refreshed = await fetchManagedCheckTarget(portalToken, targetId)
      setTarget(refreshed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao remover a foto.')
    } finally {
      setBusyKey(null)
    }
  }

  if (!canManageCheckTargets) {
    return <Navigate to="/inicio" replace />
  }

  if (!Number.isFinite(targetId) || targetId <= 0) {
    return <Navigate to="/gestao/locais" replace />
  }

  return (
    <section className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          e.target.value = ''
          void handlePhotoSelected(file)
        }}
      />

      <Link
        to="/gestao/locais"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep"
      >
        <ChevronLeft className="size-4" />
        Locais e equipamentos
      </Link>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-600">
          <Loader2 className="size-4 animate-spin" />
          Carregando…
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {!isLoading && target ? (
        <PortalSectionCard
          title={target.name}
          description={`${kindLabel(target.kind)}${target.code ? ` · ${target.code}` : ''}`}
        >
          <div className="space-y-4 px-4 py-4">
            {target.items.length === 0 ? (
              <p className="text-sm text-slate-600">Este local ainda não tem itens ativos.</p>
            ) : (
              target.items.map((item) => {
                const busy = busyKey === `item:${item.id}`
                return (
                  <article key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    {item.instruction ? (
                      <p className="mt-1 text-xs text-slate-500">{item.instruction}</p>
                    ) : null}

                    <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Referência — {item.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.referenceAttachments.map((ref) => {
                        const preview = entryFor('ref', ref.id)
                        const alt = `Referência — ${item.name}`
                        const deleting = busyKey === `ref:${ref.id}`
                        return (
                          <div key={ref.id} className="relative">
                            <button
                              type="button"
                              className="h-20 w-20 overflow-hidden rounded-lg bg-slate-100"
                              onClick={() => {
                                if (preview.url) setLightbox({ src: preview.url, alt })
                              }}
                            >
                              {preview.url ? (
                                <img src={preview.url} alt={alt} className="h-full w-full object-cover" />
                              ) : (
                                <span className="grid h-full place-items-center text-[10px] text-slate-400">
                                  {preview.status === 'loading' ? '…' : 'ref'}
                                </span>
                              )}
                            </button>
                            <div className="mt-1 flex gap-1">
                              <button
                                type="button"
                                disabled={busy || deleting}
                                className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 disabled:opacity-40"
                                onClick={() => openCamera({ itemId: item.id, replaceAttachmentId: ref.id })}
                              >
                                Trocar
                              </button>
                              <button
                                type="button"
                                disabled={busy || deleting}
                                className="inline-flex items-center gap-0.5 rounded-md border border-rose-200 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 disabled:opacity-40"
                                onClick={() => void handleDelete(ref.id)}
                                aria-label={`Remover referência de ${item.name}`}
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openCamera({ itemId: item.id })}
                        className="inline-flex h-20 min-w-[5rem] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 text-xs text-slate-700 disabled:opacity-40"
                      >
                        <Camera className="h-4 w-4" />
                        {busy ? 'Enviando…' : item.referenceAttachments.length ? 'Adicionar' : 'Tirar foto'}
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </PortalSectionCard>
      ) : null}

      <PhotoLightbox
        open={Boolean(lightbox)}
        src={lightbox?.src ?? null}
        alt={lightbox?.alt ?? ''}
        onClose={() => setLightbox(null)}
      />
    </section>
  )
}
