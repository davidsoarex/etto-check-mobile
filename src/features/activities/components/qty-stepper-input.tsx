import { useEffect, useRef, type PointerEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
  formatQtyDraft,
  normalizeQtyForUnit,
  qtyStepForUnit,
} from '@/features/activities/lib/qty-helpers'

type Props = {
  value: string
  onChange: (next: string) => void
  onCommit?: () => void
  measureUnit?: string | null
  disabled?: boolean
}

function holdIntervalMs(heldForMs: number): number {
  if (heldForMs > 2500) return 40
  if (heldForMs > 1500) return 55
  if (heldForMs > 800) return 80
  return 120
}

function holdStepMultiplier(heldForMs: number): number {
  if (heldForMs > 3000) return 5
  if (heldForMs > 1800) return 3
  if (heldForMs > 1000) return 2
  return 1
}

export function QtyStepperInput({ value, onChange, onCommit, measureUnit, disabled }: Props) {
  const step = qtyStepForUnit(measureUnit)
  const integerOnly = step >= 1
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onCommitRef = useRef(onCommit)
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdStartedAtRef = useRef(0)
  const holdActiveRef = useRef(false)

  valueRef.current = value
  onChangeRef.current = onChange
  onCommitRef.current = onCommit

  const clearHold = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
    holdTimeoutRef.current = null
    holdActiveRef.current = false
  }

  useEffect(() => () => clearHold(), [])

  const bump = (dir: 1 | -1) => {
    const current = normalizeQtyForUnit(valueRef.current || '0', measureUnit) ?? 0
    const mult = holdActiveRef.current
      ? holdStepMultiplier(Date.now() - holdStartedAtRef.current)
      : 1
    const next = Math.max(0, current + dir * step * mult)
    const formatted = formatQtyDraft(integerOnly ? Math.round(next) : Math.round(next * 1000) / 1000)
    onChangeRef.current(formatted)
  }

  const startHold = (dir: 1 | -1) => {
    if (disabled) return
    clearHold()
    holdActiveRef.current = true
    holdStartedAtRef.current = Date.now()
    bump(dir)
    const tick = () => {
      if (!holdActiveRef.current) return
      bump(dir)
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

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        disabled={disabled}
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-40"
        onPointerDown={onPointerDown(-1)}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        aria-label="Diminuir"
      >
        <Minus className="size-4" />
      </button>
      <input
        type="text"
        inputMode={integerOnly ? 'numeric' : 'decimal'}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit?.()}
        className="min-h-9 w-[5.75rem] shrink-0 rounded-lg border border-slate-200 px-1.5 text-center text-sm font-semibold tabular-nums text-slate-900 disabled:bg-slate-50"
        aria-label={`Quantidade${measureUnit ? ` (${measureUnit})` : ''}`}
      />
      <button
        type="button"
        disabled={disabled}
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-40"
        onPointerDown={onPointerDown(1)}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        aria-label="Aumentar"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
