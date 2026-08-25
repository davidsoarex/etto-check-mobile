import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
  computeTotalFromPackages,
  decomposeContado,
  type ConferencePackageDef,
  type PackageBreakdown,
} from '@/features/activities/lib/package-count'
import { qtyStepForUnit } from '@/features/activities/lib/qty-helpers'

type Props = {
  packages: ConferencePackageDef[]
  unit: string | null
  value: PackageBreakdown
  onChange: (next: PackageBreakdown) => void
  onCommit?: () => void
  disabled?: boolean
  /**
   * Unidades soltas / avulsa — só bebidas (fardo 6/12).
   * Salgados/pastéis e pacotes pré-definidos ficam só com os steppers de embalagem.
   */
  allowLoose?: boolean
  /** Quando true, remove borda/fundo próprios (já vem de um card pai). */
  embedded?: boolean
  header?: ReactNode
}

function holdIntervalMs(heldForMs: number): number {
  if (heldForMs > 2500) return 40
  if (heldForMs > 1500) return 55
  if (heldForMs > 800) return 80
  return 120
}

function PackageStepper({
  label,
  count,
  disabled,
  onBump,
  onCommit,
}: {
  label: string
  count: number
  disabled?: boolean
  onBump: (dir: 1 | -1) => void
  onCommit?: () => void
}) {
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdStartedAtRef = useRef(0)
  const holdActiveRef = useRef(false)
  const onBumpRef = useRef(onBump)
  const onCommitRef = useRef(onCommit)
  onBumpRef.current = onBump
  onCommitRef.current = onCommit

  const clearHold = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
    holdTimeoutRef.current = null
    holdActiveRef.current = false
  }

  useEffect(() => () => clearHold(), [])

  const startHold = (dir: 1 | -1) => {
    if (disabled) return
    clearHold()
    holdActiveRef.current = true
    holdStartedAtRef.current = Date.now()
    onBumpRef.current(dir)
    const tick = () => {
      if (!holdActiveRef.current) return
      onBumpRef.current(dir)
      holdTimeoutRef.current = setTimeout(tick, holdIntervalMs(Date.now() - holdStartedAtRef.current))
    }
    holdTimeoutRef.current = setTimeout(tick, 350)
  }

  const endHold = () => {
    const was = holdActiveRef.current
    clearHold()
    if (was) onCommitRef.current?.()
  }

  const onPointerDown = (dir: 1 | -1) => (e: PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    startHold(dir)
  }

  const display =
    Number.isInteger(count) || Math.abs(count - Math.round(count)) < 0.0005
      ? String(Math.round(count))
      : String(Math.round(count * 1000) / 1000)

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="min-w-0 flex-1 text-xs font-semibold text-slate-700">{label}</p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-40"
          onPointerDown={onPointerDown(-1)}
          onPointerUp={endHold}
          onPointerCancel={endHold}
          aria-label={`Diminuir ${label}`}
        >
          <Minus className="size-4" />
        </button>
        <span className="min-w-[2.5rem] text-center text-base font-bold tabular-nums text-slate-900">
          {display}
        </span>
        <button
          type="button"
          disabled={disabled}
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-teal-200 bg-teal-50 text-teal-900 disabled:opacity-40"
          onPointerDown={onPointerDown(1)}
          onPointerUp={endHold}
          onPointerCancel={endHold}
          aria-label={`Aumentar ${label}`}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function PackageCountInput({
  packages,
  unit,
  value,
  onChange,
  onCommit,
  disabled,
  allowLoose = false,
  embedded,
  header,
}: Props) {
  const unitLabel = (unit ?? '').trim() || 'un'
  const isUnitCount =
    unitLabel.toLowerCase() === 'un' ||
    unitLabel.toLowerCase() === 'und' ||
    unitLabel.toLowerCase() === 'unidade' ||
    unitLabel.toLowerCase() === 'unidades'
  const packWord = isUnitCount ? 'Fardos' : 'Pacotes'
  const looseLabel = isUnitCount ? 'Unidades soltas' : 'Quantidade avulsa'
  const looseStep = isUnitCount ? 1 : qtyStepForUnit(unit)
  const sorted = [...packages].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1
    if (!a.isDefault && b.isDefault) return 1
    return b.quantity - a.quantity
  })
  const effectiveValue: PackageBreakdown = allowLoose
    ? value
    : { counts: value.counts, loose: 0 }
  const total = computeTotalFromPackages(effectiveValue)

  const setCount = (quantity: number, nextCount: number) => {
    const counts = { ...value.counts, [quantity]: Math.max(0, Math.floor(nextCount)) }
    onChange({ counts, loose: allowLoose ? value.loose : 0 })
  }

  const setLoose = (nextLoose: number) => {
    if (!allowLoose) return
    const rounded =
      looseStep >= 1
        ? Math.max(0, Math.floor(nextLoose))
        : Math.max(0, Math.round(nextLoose * 1000) / 1000)
    onChange({ counts: value.counts, loose: rounded })
  }

  return (
    <div
      className={
        embedded
          ? 'space-y-2.5'
          : 'overflow-hidden rounded-xl border border-teal-200 bg-teal-50/50'
      }
    >
      {header ? (
        <div className="border-b border-teal-200/80 bg-white/50 px-3 py-2.5">{header}</div>
      ) : null}
      <div className={embedded ? 'space-y-2.5' : 'space-y-2.5 px-3 py-2.5'}>
        {sorted.map((pkg) => {
          const count = effectiveValue.counts[pkg.quantity] ?? 0
          const subtotal = Math.round(pkg.quantity * count * 1000) / 1000
          return (
            <div key={pkg.quantity} className="space-y-1">
              <PackageStepper
                label={`${packWord} de ${pkg.quantity} ${unitLabel}${pkg.isDefault ? ' (padrão)' : ''}`}
                count={count}
                disabled={disabled}
                onBump={(dir) => setCount(pkg.quantity, count + dir)}
                onCommit={onCommit}
              />
              <p className="text-right text-[10px] tabular-nums text-slate-500">
                = {subtotal} {unitLabel}
              </p>
            </div>
          )
        })}

        {allowLoose ? (
          <div className="space-y-1 border-t border-teal-100 pt-2">
            <PackageStepper
              label={looseLabel}
              count={effectiveValue.loose}
              disabled={disabled}
              onBump={(dir) => setLoose(effectiveValue.loose + dir * looseStep)}
              onCommit={onCommit}
            />
            {effectiveValue.loose > 0 ? (
              <p className="text-right text-[10px] tabular-nums text-slate-500">
                = {effectiveValue.loose} {unitLabel}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="border-t border-teal-100 pt-2 text-right text-sm font-bold tabular-nums text-teal-950">
          TOTAL {total} {unitLabel}
        </p>
      </div>
    </div>
  )
}

export function initialBreakdownFromLine(
  packages: ConferencePackageDef[],
  contado: number | null,
  allowLoose = false,
): PackageBreakdown {
  if (contado == null || contado <= 0) {
    const counts: Record<number, number> = {}
    for (const p of packages) counts[p.quantity] = 0
    return { counts, loose: 0 }
  }
  const bd = decomposeContado(contado, packages)
  if (allowLoose) return bd
  return { counts: bd.counts, loose: 0 }
}
