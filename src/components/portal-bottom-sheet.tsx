import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

type PortalBottomSheetProps = {
  title: string
  titleId?: string
  onClose: () => void
  children: ReactNode
}

export function PortalBottomSheet({ title, titleId, onClose, children }: PortalBottomSheetProps) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="relative flex h-full w-full max-w-md flex-col justify-end overflow-hidden px-3 pb-24">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/45"
          aria-label="Fechar"
          onClick={onClose}
        />

        <div
          className="relative max-h-[75dvh] w-full min-w-0 overflow-x-hidden overflow-y-auto rounded-t-2xl bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <h2 id={titleId} className="text-sm font-semibold text-slate-900">
              {title}
            </h2>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="px-4 py-4">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function PortalDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-900">{value}</p>
    </div>
  )
}
