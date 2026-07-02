import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import { formatPortalDate, formatPortalDateTime } from '@/lib/portal-format'
import {
  fetchEcheckPhotoBlob,
  fetchSupervisorValidationDetail,
  validateSupervisorSubmission,
  type EcheckSupervisorValidationDetail,
} from '@/services/echeck-api'

export function ValidationDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const navigate = useNavigate()
  const { portalToken, canValidateSubmissions } = useAuth()
  const [detail, setDetail] = useState<EcheckSupervisorValidationDetail | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [validationNotes, setValidationNotes] = useState('')
  const [isValidating, setIsValidating] = useState<'approved' | 'rejected' | null>(null)

  const load = useCallback(() => {
    if (!portalToken || !submissionId || !canValidateSubmissions) return
    const id = Number(submissionId)
    if (!Number.isFinite(id)) {
      setError('Registro inválido.')
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    void fetchSupervisorValidationDetail(portalToken, id)
      .then((data) => {
        setDetail(data)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar registro.'))
      .finally(() => setIsLoading(false))
  }, [canValidateSubmissions, portalToken, submissionId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!portalToken || !detail) return
    let cancelled = false
    const tasksWithPhoto = detail.tasks.filter((task) => task.photo?.id)
    void Promise.all(
      tasksWithPhoto.map(async (task) => {
        const photoId = task.photo!.id
        try {
          const url = await fetchEcheckPhotoBlob(portalToken, photoId)
          if (!cancelled) {
            setPreviewUrls((prev) => (prev[photoId] ? prev : { ...prev, [photoId]: url }))
          }
        } catch {
          /* ignore preview errors */
        }
      }),
    )
    return () => {
      cancelled = true
    }
  }, [detail, portalToken])

  async function handleValidate(status: 'approved' | 'rejected') {
    if (!portalToken || !detail) return
    setIsValidating(status)
    setError(null)
    try {
      await validateSupervisorSubmission(portalToken, detail.id, {
        status,
        validationNotes: status === 'rejected' ? validationNotes.trim() || null : null,
      })
      navigate('/validacao', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao validar registro.')
    } finally {
      setIsValidating(null)
    }
  }

  if (!canValidateSubmissions) {
    return (
      <section className="space-y-3">
        <Link
          to="/inicio"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep"
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Link>
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Você não tem permissão para validar registros.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <Link
        to="/validacao"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep"
      >
        <ChevronLeft className="size-4" />
        Voltar à fila
      </Link>

      {isLoading && <p className="text-sm text-slate-600">Carregando…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {detail && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">{detail.routineName ?? 'Rotina'}</h1>
            <p className="mt-1 text-sm text-slate-600">{detail.collaboratorName ?? 'Colaborador'}</p>
            <p className="mt-2 text-xs text-slate-500">
              Referência {formatPortalDate(detail.referenceDate)}
              {detail.submittedAt ? ` · Enviado ${formatPortalDateTime(detail.submittedAt)}` : null}
            </p>
          </div>

          <PortalSectionCard title="Fotos das tarefas" description="Confira cada foto antes de validar.">
            <div className="divide-y divide-slate-100">
              {detail.tasks.map((task) => {
                const photoId = task.photo?.id
                const preview = photoId ? previewUrls[photoId] : null
                return (
                  <div key={task.id} className="space-y-3 px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      {task.instructions ? (
                        <p className="mt-1 text-xs text-slate-600">{task.instructions}</p>
                      ) : null}
                      {task.photo?.takenAt ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Capturada {formatPortalDateTime(task.photo.takenAt)}
                        </p>
                      ) : null}
                    </div>
                    {preview ? (
                      <img
                        src={preview}
                        alt={task.title}
                        className="max-h-56 w-full rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
                        {task.photo ? 'Carregando foto…' : 'Sem foto registrada'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </PortalSectionCard>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">
              Motivo da rejeição (opcional, usado se rejeitar)
            </span>
            <textarea
              value={validationNotes}
              onChange={(event) => setValidationNotes(event.target.value)}
              rows={3}
              placeholder="Descreva o que precisa ser corrigido…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-cobalt/40 focus:ring-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={Boolean(isValidating)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 disabled:opacity-60"
              onClick={() => void handleValidate('rejected')}
            >
              {isValidating === 'rejected' ? <Loader2 className="size-4 animate-spin" /> : null}
              Rejeitar
            </button>
            <button
              type="button"
              disabled={Boolean(isValidating)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void handleValidate('approved')}
            >
              {isValidating === 'approved' ? <Loader2 className="size-4 animate-spin" /> : null}
              Aprovar
            </button>
          </div>
        </>
      )}
    </section>
  )
}
