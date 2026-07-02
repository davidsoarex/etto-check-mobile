import { ETTO_BRAND_NAME, ETTO_INSTAGRAM_HANDLE, ETTO_INSTAGRAM_URL } from '@/lib/etto-brand'

type Props = {
  className?: string
  compact?: boolean
  onDark?: boolean
}

export function EttoAppFooter({ className = '', compact = false, onDark = false }: Props) {
  return (
    <footer
      className={`text-center ${onDark ? 'text-white/70' : 'text-slate-500'} ${compact ? 'py-2' : 'py-2.5'} ${className}`}
      aria-label="Créditos do aplicativo"
    >
      <p className={compact ? 'text-[10px] leading-relaxed' : 'text-[11px] leading-relaxed'}>
        Criado com{' '}
        <span className={onDark ? 'font-semibold text-white/90' : 'font-semibold text-slate-600'}>
          {ETTO_BRAND_NAME}
        </span>
        <span className={onDark ? 'mx-1 text-white/40' : 'mx-1 text-slate-300'} aria-hidden>
          ·
        </span>
        <a
          href={ETTO_INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={
            onDark
              ? 'font-medium text-white/90 underline-offset-2 hover:text-white hover:underline'
              : 'font-medium text-slate-600 underline-offset-2 hover:text-brand-cobalt hover:underline'
          }
        >
          {ETTO_INSTAGRAM_HANDLE}
        </a>
      </p>
    </footer>
  )
}
