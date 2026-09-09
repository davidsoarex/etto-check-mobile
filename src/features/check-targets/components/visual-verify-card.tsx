import { Loader2 } from 'lucide-react'
import type { VisualVerifyView } from '@/features/check-targets/lib/visual-verify'

type Props = {
  view: VisualVerifyView
  onRetryPhoto: () => void
  onRetryVerify?: () => void
  onOpenReference?: () => void
  onOpenEvidence?: () => void
  canOpenReference?: boolean
  canOpenEvidence?: boolean
}

export function VisualVerifyCard({
  view,
  onRetryPhoto,
  onRetryVerify,
  onOpenReference,
  onOpenEvidence,
  canOpenReference,
  canOpenEvidence,
}: Props) {
  if (view.kind === 'hidden') return null

  if (view.kind === 'loading') {
    return (
      <div
        className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"
        data-testid="visual-verify-loading"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        {view.label}
      </div>
    )
  }

  const compareLinks =
    (canOpenReference && onOpenReference) || (canOpenEvidence && onOpenEvidence) ? (
      <div className="flex flex-wrap gap-3">
        {canOpenReference && onOpenReference ? (
          <button
            type="button"
            onClick={onOpenReference}
            className="text-xs font-medium text-brand-cobalt underline"
          >
            Ver referência
          </button>
        ) : null}
        {canOpenEvidence && onOpenEvidence ? (
          <button
            type="button"
            onClick={onOpenEvidence}
            className="text-xs font-medium text-brand-cobalt underline"
          >
            Ver evidência atual
          </button>
        ) : null}
      </div>
    ) : null

  if (view.kind === 'ok') {
    return (
      <div
        className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3"
        data-testid="visual-verify-ok"
      >
        <p className="text-sm font-semibold text-emerald-900">{view.title}</p>
        <p className="text-sm text-emerald-900">{view.summary}</p>
        <p className="text-[11px] text-emerald-800/80">{view.hint}</p>
        {compareLinks}
      </div>
    )
  }

  if (view.kind === 'network_error') {
    return (
      <div
        className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
        data-testid="visual-verify-network-error"
      >
        <p className="text-sm text-slate-800">{view.message}</p>
        <div className="flex flex-col gap-2">
          {onRetryVerify ? (
            <button
              type="button"
              onClick={onRetryVerify}
              className="h-10 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
            >
              Tentar verificar novamente
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRetryPhoto}
            className="h-11 rounded-xl bg-brand-cobalt text-sm font-semibold text-white"
          >
            Refazer evidência
          </button>
        </div>
      </div>
    )
  }

  const retryLabel = 'Refazer evidência'
  const testId =
    view.kind === 'needs_improvement' ? 'visual-verify-needs-improvement' : 'visual-verify-unable'

  return (
    <div
      className={
        view.kind === 'needs_improvement'
          ? 'space-y-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3'
          : 'space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3'
      }
      data-testid={testId}
    >
      <p className="text-sm font-semibold text-slate-900">{view.title}</p>
      <p className="text-sm text-slate-800">{view.summary}</p>
      {view.improvements.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          {view.improvements.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      ) : null}
      {compareLinks}
      {view.showRetry ? (
        <button
          type="button"
          onClick={onRetryPhoto}
          className="h-11 w-full rounded-xl bg-brand-cobalt text-sm font-semibold text-white"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}
