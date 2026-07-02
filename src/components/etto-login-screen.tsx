import type { ReactNode } from 'react'
import { EttoAppShellBg } from '@/components/etto-app-shell-bg'

type EttoLoginScreenProps = {
  portalLabel: string
  title: string
  description?: string
  children: ReactNode
}

export function EttoLoginScreen({ portalLabel, title, description, children }: EttoLoginScreenProps) {
  return (
    <div
      className="relative min-h-dvh w-full overflow-x-hidden bg-brand-deep"
      style={{ backgroundColor: 'var(--etto-brand-deep, #0f3b82)' }}
    >
      <EttoAppShellBg />
      <div className="relative z-10 mx-auto flex w-full min-h-dvh max-w-md flex-col items-stretch overflow-y-auto px-4 py-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-center sm:px-5 sm:py-8">
        <div className="flex w-full flex-col items-center gap-2 pt-2 text-center sm:pt-0">
          <img
            src="/imgs/etto-logo.png"
            alt="E•tto — ERP de Operações Integradas"
            className="h-auto w-[72vw] max-w-[13rem] object-contain drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)]"
            draggable={false}
          />
          <p className="max-w-full px-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/80 drop-shadow-md [text-shadow:0_1px_3px_rgba(0,0,0,0.45)] sm:text-xs sm:tracking-[0.2em]">
            {portalLabel}
          </p>
        </div>

        <div className="mt-4 w-full min-w-0 shrink-0 rounded-2xl border border-white/20 bg-white/95 p-4 shadow-2xl backdrop-blur-sm sm:mt-6 sm:p-6">
          <h1 className="text-lg font-semibold text-slate-900 sm:text-2xl">{title}</h1>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
          ) : null}
          <div className="mt-4 min-w-0 sm:mt-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
