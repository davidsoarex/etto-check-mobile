import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/context/use-auth'
import { PortalSectionCard } from '@/components/portal-section-card'
import {
  fetchIssueAttachmentBlob,
  fetchMyOperationalIssues,
  type MyOperationalIssue,
} from '@/features/activities/api/activities-api'

function statusLabel(status: string): string {
  if (status === 'open') return 'Aberto — aguardando operação'
  if (status === 'acknowledged') return 'Ciente — em andamento'
  if (status === 'resolved') return 'Resolvido'
  if (status === 'cancelled') return 'Cancelado'
  return status
}

function statusTone(status: string): string {
  if (status === 'resolved') return 'bg-emerald-100 text-emerald-900'
  if (status === 'cancelled') return 'bg-slate-100 text-slate-700'
  if (status === 'acknowledged') return 'bg-sky-100 text-sky-900'
  return 'bg-amber-100 text-amber-950'
}

function impactLabel(impact: string): string {
  if (impact === 'blocked') return 'Não consegue seguir'
  if (impact === 'degraded') return 'Com dificuldade'
  return 'Precisa atenção'
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function IssuePhoto({ token, attachmentId }: { token: string; attachmentId: number }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    void fetchIssueAttachmentBlob(token, attachmentId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [token, attachmentId])

  if (!url) {
    return (
      <div className="grid h-14 w-14 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-400">
        …
      </div>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt="Evidência"
        className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
      />
    </a>
  )
}

export function MyIssuesPage() {
  const { portalToken } = useAuth()
  const [rows, setRows] = useState<MyOperationalIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!portalToken) return
    setLoading(true)
    try {
      const data = await fetchMyOperationalIssues(portalToken)
      setRows(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar problemas.')
    } finally {
      setLoading(false)
    }
  }, [portalToken])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <Link
          to="/inicio"
          className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-deep"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          Início
        </Link>
        <Link to="/relatar-problema" className="text-xs font-semibold text-brand-deep">
          Novo relato
        </Link>
      </div>

      <PortalSectionCard
        title="Meus problemas"
        description="Acompanhe o status dos relatos enviados à operação."
      >
        <div className="space-y-3 px-4 py-4">
          {loading ? <p className="text-sm text-slate-600">Carregando…</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="text-sm text-slate-600">
              Você ainda não reportou problemas.{' '}
              <Link to="/relatar-problema" className="font-semibold text-brand-deep">
                Relatar agora
              </Link>
            </p>
          ) : null}

          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{row.title}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(row.status)}`}
                >
                  {statusLabel(row.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {impactLabel(row.operationalImpact)}
                {row.locationLabel ? ` · ${row.locationLabel}` : ''}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Enviado em {formatWhen(row.reportedAt)}
                {row.acknowledgedAt ? ` · Ciente em ${formatWhen(row.acknowledgedAt)}` : ''}
                {row.resolvedAt ? ` · Resolvido em ${formatWhen(row.resolvedAt)}` : ''}
              </p>
              {row.description ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{row.description}</p>
              ) : null}
              {row.resolutionNote ? (
                <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
                  Resposta da operação: {row.resolutionNote}
                </p>
              ) : null}
              {portalToken && row.attachments?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.attachments.map((att) => (
                    <IssuePhoto key={att.id} token={portalToken} attachmentId={att.id} />
                  ))}
                </div>
              ) : null}
            </article>
          ))}

          <button
            type="button"
            onClick={() => void load()}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700"
          >
            Atualizar
          </button>
        </div>
      </PortalSectionCard>
    </section>
  )
}
