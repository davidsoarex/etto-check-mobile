import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Camera, CheckCircle2, ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import { PhotoLightbox } from '@/components/photo-lightbox'
import { EcheckPhotoPreviewSlot } from '@/components/echeck-photo-preview-slot'
import { useEcheckPhotoPreviews } from '@/hooks/use-echeck-photo-previews'
import { compressEcheckPhotoForUpload } from '@/lib/compress-echeck-photo'
import {
  fetchEcheckRoutineSession,
  submitEcheckForValidation,
  uploadEcheckTaskPhoto,
  type EcheckRoutineSession,
} from '@/services/echeck-api'

export function RoutinePage() {
  const { routineId } = useParams<{ routineId: string }>()
  const { portalToken } = useAuth()
  const [session, setSession] = useState<EcheckRoutineSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingTaskId, setUploadingTaskId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingTaskIdRef = useRef<number | null>(null)

  const photoItems =
    session?.tasks
      .filter((task) => task.photo.hasPhoto && task.photo.id != null)
      .map((task) => ({
        photoId: task.photo.id!,
        takenAt: task.photo.takenAt,
        label: task.title,
      })) ?? []

  const { entryFor, setLocalPreview, retryPreview, lightbox, openLightbox, closeLightbox } =
    useEcheckPhotoPreviews(portalToken ?? undefined, photoItems)

  const load = useCallback(() => {
    if (!portalToken || !routineId) return
    const id = Number(routineId)
    if (!Number.isFinite(id)) {
      setError('Rotina inválida.')
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    void fetchEcheckRoutineSession(portalToken, id)
      .then((data) => {
        setSession(data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar rotina.'))
      .finally(() => setIsLoading(false))
  }, [portalToken, routineId])

  useEffect(() => {
    load()
  }, [load])

  const editable = session?.submission.status === 'in_progress'

  function openCamera(taskId: number) {
    if (!editable) return
    pendingTaskIdRef.current = taskId
    fileInputRef.current?.click()
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const taskId = pendingTaskIdRef.current
    event.target.value = ''
    if (!file || !taskId || !portalToken || !session) return

    setUploadingTaskId(taskId)
    const uploadStarted = performance.now()
    try {
      const { file: compressed, metrics } = await compressEcheckPhotoForUpload(file)
      console.info('[echeck-photo-upload]', {
        taskId,
        compressMs: metrics.processMs,
        beforeBytes: metrics.beforeBytes,
        afterBytes: metrics.afterBytes,
      })

      const updated = await uploadEcheckTaskPhoto(
        portalToken,
        session.submission.id,
        taskId,
        compressed,
      )
      console.info('[echeck-photo-upload]', {
        taskId,
        uploadMs: Math.round(performance.now() - uploadStarted),
        afterBytes: metrics.afterBytes,
      })

      setSession(updated)
      const uploaded = updated.tasks.find((task) => task.id === taskId)?.photo
      if (uploaded?.id != null) {
        setLocalPreview(uploaded.id, uploaded.takenAt, compressed)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar foto.')
    } finally {
      setUploadingTaskId(null)
      pendingTaskIdRef.current = null
    }
  }

  async function handleSubmit() {
    if (!portalToken || !session?.submission.canSubmit) return
    setIsSubmitting(true)
    try {
      const updated = await submitEcheckForValidation(portalToken, session.submission.id)
      setSession(updated)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar para validação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="space-y-3">
      <Link
        to="/inicio"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep"
      >
        <ChevronLeft className="size-4" />
        Voltar às rotinas
      </Link>
      {isLoading && <p className="text-sm text-slate-600">Carregando…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {session && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">{session.routine.name}</h1>
            {session.routine.description ? (
              <p className="mt-1 text-sm text-slate-600">{session.routine.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              {session.submission.completedCount}/{session.submission.requiredCount} fotos registradas
            </p>
          </div>
          <PortalSectionCard title="Tarefas fotográficas" description="Capture uma foto para cada item.">
            <div className="divide-y divide-slate-100">
              {session.tasks.map((task) => {
                const photoId = task.photo.id
                const entry =
                  photoId != null
                    ? entryFor(photoId, task.photo.takenAt)
                    : { status: 'idle' as const, url: null, error: null }
                const busy = uploadingTaskId === task.id
                return (
                  <div key={task.id} className="space-y-3 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 size-2.5 shrink-0 rounded-full ${
                          task.photo.hasPhoto ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                        {task.instructions ? (
                          <p className="mt-1 text-xs text-slate-600">{task.instructions}</p>
                        ) : null}
                      </div>
                      {task.photo.hasPhoto ? (
                        <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                      ) : null}
                    </div>
                    {task.photo.hasPhoto ? (
                      <EcheckPhotoPreviewSlot
                        entry={entry}
                        label={task.title}
                        maxHeightClass="max-h-48"
                        onOpen={(src) => openLightbox(src, task.title)}
                        onRetry={
                          photoId != null
                            ? () => retryPreview(photoId, task.photo.takenAt)
                            : undefined
                        }
                      />
                    ) : null}
                    {editable ? (
                      <button
                        type="button"
                        disabled={busy}
                        className={
                          task.photo.hasPhoto
                            ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60'
                            : 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-deep px-4 py-3 text-sm font-semibold text-white disabled:opacity-60'
                        }
                        onClick={() => openCamera(task.id)}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : task.photo.hasPhoto ? (
                          <RefreshCw className="size-4" />
                        ) : (
                          <Camera className="size-4" />
                        )}
                        {task.photo.hasPhoto ? 'Refazer foto' : 'Capturar foto'}
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </PortalSectionCard>
          {editable && session.submission.canSubmit ? (
            <button
              type="button"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? 'Enviando…' : 'Enviar para validação'}
            </button>
          ) : null}
          {session.submission.status === 'pending_validation' ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Rotina enviada. Aguardando validação do administrador.
            </p>
          ) : null}
          {session.submission.status === 'approved' ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Rotina aprovada pelo administrador.
            </p>
          ) : null}
          {session.submission.validationNotes && session.submission.status === 'in_progress' ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              Ajuste solicitado: {session.submission.validationNotes}. Refaça as fotos e envie novamente.
            </p>
          ) : null}
          {session.submission.status === 'rejected' ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              Rotina rejeitada.
              {session.submission.validationNotes
                ? ` Motivo: ${session.submission.validationNotes}`
                : ' Fale com seu superior.'}
            </p>
          ) : null}
        </>
      )}
      <PhotoLightbox
        open={Boolean(lightbox)}
        src={lightbox?.src ?? null}
        alt={lightbox?.label ?? 'Foto'}
        onClose={closeLightbox}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
    </section>
  )
}
