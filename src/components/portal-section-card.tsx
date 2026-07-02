import type { ReactNode } from 'react'

type PortalSectionCardProps = {
  title: string
  description: string
  children: ReactNode
  headerAside?: ReactNode
}

export function PortalSectionCard({ title, description, children, headerAside }: PortalSectionCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-600">{description}</p>
        </div>
        {headerAside}
      </div>
      {children}
    </section>
  )
}
