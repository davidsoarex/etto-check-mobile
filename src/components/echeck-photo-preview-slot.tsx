import type { PhotoPreviewEntry } from '@/hooks/use-echeck-photo-previews'

type Props = {
  entry: PhotoPreviewEntry
  label: string
  maxHeightClass?: string
  onOpen?: (src: string) => void
  onRetry?: () => void
}

export function EcheckPhotoPreviewSlot({
  entry,
  label,
  maxHeightClass = 'max-h-56',
  onOpen,
  onRetry,
}: Props) {
  if (entry.status === 'ready' && entry.url) {
    return (
      <button
        type="button"
        className="block w-full overflow-hidden rounded-xl border border-slate-200"
        onClick={() => onOpen?.(entry.url!)}
      >
        <img src={entry.url} alt={label} className={`${maxHeightClass} w-full object-cover`} />
        <span className="block bg-slate-50 px-3 py-1.5 text-center text-[11px] text-slate-500">
          Toque para ampliar
        </span>
      </button>
    )
  }

  if (entry.status === 'error') {
    return (
      <div className="space-y-2 rounded-xl border border-dashed border-rose-200 bg-rose-50/60 px-4 py-5 text-center">
        <p className="text-xs text-rose-800">
          {entry.error ?? 'Não foi possível carregar a foto.'}
        </p>
        {onRetry ? (
          <button
            type="button"
            className="text-xs font-semibold text-brand-deep underline-offset-2 hover:underline"
            onClick={onRetry}
          >
            Tentar novamente
          </button>
        ) : null}
      </div>
    )
  }

  if (entry.status === 'loading') {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
        Carregando foto…
      </p>
    )
  }

  return (
    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
      Sem foto registrada
    </p>
  )
}
