export function moneyPt(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatPortalDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatPortalDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('pt-BR')
}

export function formatPendingRegisterDays(
  registers: Array<{ entryDate?: string | null; exitDate?: string | null; pendenteRevisaoPonto?: boolean }>,
): string[] {
  const byDay = new Map<string, Date>()

  for (const register of registers) {
    if (!register.pendenteRevisaoPonto) continue
    const raw = register.entryDate ?? register.exitDate
    if (!raw) continue
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) continue
    const key = date.toISOString().slice(0, 10)
    byDay.set(key, date)
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, date]) => date.toLocaleDateString('pt-BR'))
}

export const PONTO_PENDENCIA_ORIENTACAO =
  'Fale com seu superior para regularizar essas marcações de ponto.'

const ACCOUNT_TX_CATEGORY_LABELS: Record<string, string> = {
  ajuste_manual: 'Ajuste manual',
  adiantamento: 'Adiantamento',
  outros: 'Outros',
  transferencia_sistemas: 'Transferência de sistemas',
}

const ACCOUNT_TX_PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
  payroll: 'Folha',
  fiado: 'Fiado',
  internal: 'Interno (fiado)',
  checkout: 'Pedido PDV',
}

const ACCOUNT_TX_ORIGIN_LABELS: Record<string, string> = {
  internal_sale: 'Venda interna',
  internal_checkout_payment: 'Venda interna (parcela)',
  manual: 'Lançamento manual',
  settlement: 'Baixa',
  rounding_adjustment: 'Arredondamento',
  reversal: 'Estorno',
}

export function isAccountTransactionCredit(type: string | null | undefined): boolean {
  return String(type ?? '').toLowerCase() === 'credit'
}

export function accountTransactionNatureLabel(type: string | null | undefined): string {
  return isAccountTransactionCredit(type) ? 'Entrada' : 'Saída'
}

export function accountTransactionCategoryLabel(category: string | null | undefined): string {
  if (!category) return '—'
  return ACCOUNT_TX_CATEGORY_LABELS[category] ?? category.replaceAll('_', ' ')
}

export function accountTransactionLedgerLabel(ledger: string | null | undefined): string {
  return ledger === 'adiantamento' ? 'Adiantamento' : 'Fiado'
}

export function accountTransactionPaymentLabel(paymentMethod: string | null | undefined): string {
  if (!paymentMethod) return '—'
  return ACCOUNT_TX_PAYMENT_LABELS[paymentMethod] ?? paymentMethod
}

export function accountTransactionOriginLabel(
  originType: string | null | undefined,
  originId: number | null | undefined,
): string {
  if (!originType) return '—'
  const base = ACCOUNT_TX_ORIGIN_LABELS[originType] ?? originType.replaceAll('_', ' ')
  return originId ? `${base} #${originId}` : base
}

export function formatAccountTransactionSignedAmount(tx: {
  type?: string | null
  amount: number
}): string {
  const credit = isAccountTransactionCredit(tx.type)
  const prefix = credit ? '+ ' : '− '
  return `${prefix}${moneyPt(Math.abs(Number(tx.amount) || 0))}`
}

export function accountTransactionAmountClassName(type: string | null | undefined): string {
  return isAccountTransactionCredit(type) ? 'text-emerald-700' : 'text-rose-700'
}

export function accountTransactionAccentClassName(type: string | null | undefined): string {
  return isAccountTransactionCredit(type) ? 'bg-emerald-500' : 'bg-rose-500'
}

export function accountTransactionSurfaceClassName(type: string | null | undefined): string {
  return isAccountTransactionCredit(type) ? 'bg-emerald-50' : 'bg-rose-50'
}

export function isActivityCompleted(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').toLowerCase()
  return normalized === 'concluido' || normalized === 'concluida'
}

export function activityStatusLabel(status: string | null | undefined): string {
  return isActivityCompleted(status) ? 'Concluída' : 'Pendente'
}

export function activityAccentClassName(status: string | null | undefined): string {
  return isActivityCompleted(status) ? 'bg-emerald-500' : 'bg-amber-500'
}

export function activityStatusTextClassName(status: string | null | undefined): string {
  return isActivityCompleted(status) ? 'text-emerald-700' : 'text-amber-700'
}

export function activitySurfaceClassName(status: string | null | undefined): string {
  return isActivityCompleted(status) ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
}

export function formatActivityReferenceDate(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  const trimmed = value.trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T12:00:00`)
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('pt-BR')
  }
  return formatPortalDate(value)
}

export function formatPayStubIsoDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—'
  const trimmed = iso.trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T12:00:00`)
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('pt-BR')
  }
  return formatPortalDateTime(iso)
}

export function payStubPaymentLabel(payrollPayable: {
  dueDate?: string | null
  status?: string | null
  paidOn?: string | null
} | null | undefined): string {
  if (!payrollPayable) return '—'
  const due = formatPayStubIsoDate(payrollPayable.dueDate ?? null)
  const status = String(payrollPayable.status ?? '').toLowerCase()
  if (status === 'pago' && payrollPayable.paidOn) {
    return `Venc. ${due} · pago ${formatPayStubIsoDate(payrollPayable.paidOn)}`
  }
  return `Venc. ${due}`
}

export function registerObservation(register: {
  isDuplicate?: boolean
  pendenteRevisaoPonto?: boolean
}): string {
  if (register.isDuplicate) return 'Duplicado'
  if (register.pendenteRevisaoPonto) return 'Fale com seu superior'
  return '—'
}
