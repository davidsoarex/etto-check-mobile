export const VISUAL_VERIFY_STATUSES = ['ok', 'needs_improvement', 'unable_to_evaluate'] as const
export type VisualVerifyStatus = (typeof VISUAL_VERIFY_STATUSES)[number]

export type VisualVerifyDto = {
  status: VisualVerifyStatus | null
  summary: string | null
  improvements?: string[]
  canRetry?: boolean
  mayAutoApprove?: boolean
  skipped?: boolean
  reason?: string
  assessmentId?: number | null
}

export type VisualVerifyView =
  | { kind: 'hidden' }
  | { kind: 'loading'; label: string }
  | {
      kind: 'ok'
      title: string
      summary: string
      hint: string
      showRetry: false
      humanChoicesEnabled: true
      autoResult: null
    }
  | {
      kind: 'needs_improvement'
      title: string
      summary: string
      improvements: string[]
      showRetry: true
      humanChoicesEnabled: true
      autoResult: null
    }
  | {
      kind: 'unable_to_evaluate'
      title: string
      summary: string
      improvements: string[]
      showRetry: true
      humanChoicesEnabled: true
      autoResult: null
    }
  | {
      kind: 'network_error'
      message: string
      showRetryVerify: true
      showRetryPhoto: true
      humanChoicesEnabled: true
      autoResult: null
    }

export type VisualVerifySlot = {
  itemId: number
  evidenceId: number
  seq: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  dto: VisualVerifyDto | null
  error: string | null
}

export function isVisualVerifySkipped(dto: VisualVerifyDto | null | undefined): boolean {
  return dto?.skipped === true
}

export function buildVisualVerifyView(
  slot: VisualVerifySlot | null,
  currentEvidenceId: number | null,
): VisualVerifyView {
  if (!slot) return { kind: 'hidden' }
  if (currentEvidenceId == null || slot.evidenceId !== currentEvidenceId) return { kind: 'hidden' }
  if (slot.status === 'loading') {
    return { kind: 'loading', label: 'Verificando a evidência…' }
  }
  if (slot.status === 'error') {
    return {
      kind: 'network_error',
      message: slot.error?.trim() || 'Não foi possível verificar a evidência agora.',
      showRetryVerify: true,
      showRetryPhoto: true,
      humanChoicesEnabled: true,
      autoResult: null,
    }
  }
  const dto = slot.dto
  if (!dto || isVisualVerifySkipped(dto) || dto.status == null) return { kind: 'hidden' }

  const improvements = Array.isArray(dto.improvements)
    ? dto.improvements.map((row) => String(row).trim()).filter(Boolean)
    : []
  const summary = String(dto.summary ?? '').trim()

  if (dto.status === 'ok') {
    return {
      kind: 'ok',
      title: 'Evidência compatível',
      summary:
        summary || 'A evidência parece atender visualmente à referência e às instruções.',
      hint: 'A verificação visual é apenas uma orientação. Confirme o resultado do item normalmente.',
      showRetry: false,
      humanChoicesEnabled: true,
      autoResult: null,
    }
  }

  if (dto.status === 'needs_improvement') {
    return {
      kind: 'needs_improvement',
      title: 'Antes de continuar, corrija estes pontos:',
      summary: summary || 'Ainda há pontos visíveis que precisam ser corrigidos.',
      improvements,
      showRetry: true,
      humanChoicesEnabled: true,
      autoResult: null,
    }
  }

  return {
    kind: 'unable_to_evaluate',
    title: 'Não foi possível avaliar esta evidência.',
    summary: summary || 'Não foi possível concluir a verificação automática.',
    improvements:
      improvements.length > 0
        ? improvements
        : ['Você pode refazer a evidência ou continuar o preenchimento manual.'],
    showRetry: true,
    humanChoicesEnabled: true,
    autoResult: null,
  }
}

export function shouldIgnoreVerifyResponse(params: {
  slot: VisualVerifySlot | null
  itemId: number
  evidenceId: number
  seq: number
}): boolean {
  if (!params.slot) return true
  if (params.slot.itemId !== params.itemId) return true
  if (params.slot.evidenceId !== params.evidenceId) return true
  if (params.slot.seq !== params.seq) return true
  return false
}

export function latestEvidenceId(
  evidences: Array<{ id: number }> | null | undefined,
): number | null {
  if (!evidences?.length) return null
  return evidences[evidences.length - 1]!.id
}
