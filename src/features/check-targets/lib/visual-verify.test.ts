import { describe, expect, it } from 'vitest'
import {
  buildVisualVerifyView,
  isVisualVerifySkipped,
  latestEvidenceId,
  shouldIgnoreVerifyResponse,
  type VisualVerifyDto,
  type VisualVerifySlot,
} from './visual-verify'

const NEEDS_IMPROVEMENT: VisualVerifyDto = {
  status: 'needs_improvement',
  summary: 'Ainda há pontos a corrigir.',
  improvements: ['Remova o resíduo do chão.', 'Organize a bancada.'],
  canRetry: true,
  mayAutoApprove: false,
}

function slot(partial: Partial<VisualVerifySlot> & Pick<VisualVerifySlot, 'dto' | 'status'>): VisualVerifySlot {
  return {
    itemId: 10,
    evidenceId: 101,
    seq: 1,
    error: null,
    ...partial,
  }
}

describe('visual verify UI contract', () => {
  it('A. needs_improvement mostra orientação e permite refazer sem registrar resultado', () => {
    const view = buildVisualVerifyView(
      slot({ status: 'ready', dto: NEEDS_IMPROVEMENT }),
      101,
    )
    expect(view.kind).toBe('needs_improvement')
    if (view.kind !== 'needs_improvement') return
    expect(view.summary).toBe('Ainda há pontos a corrigir.')
    expect(view.improvements).toEqual(['Remova o resíduo do chão.', 'Organize a bancada.'])
    expect(view.showRetry).toBe(true)
    expect(view.humanChoicesEnabled).toBe(true)
    expect(view.autoResult).toBeNull()
  })

  it('B. ok é informativo e não dispara resultado automático', () => {
    const view = buildVisualVerifyView(
      slot({
        status: 'ready',
        dto: {
          status: 'ok',
          summary: 'A evidência parece atender visualmente à referência e às instruções.',
          improvements: [],
          mayAutoApprove: false,
        },
      }),
      101,
    )
    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return
    expect(view.title).toBe('Evidência compatível')
    expect(view.summary.length).toBeGreaterThan(0)
    expect(view.showRetry).toBe(false)
    expect(view.humanChoicesEnabled).toBe(true)
    expect(view.autoResult).toBeNull()
  })

  it('C. unable_to_evaluate orienta a refazer e mantém a execução utilizável', () => {
    const view = buildVisualVerifyView(
      slot({
        status: 'ready',
        dto: {
          status: 'unable_to_evaluate',
          summary: 'A foto está desfocada.',
          improvements: ['Refaça a foto com boa iluminação mostrando toda a área.'],
          mayAutoApprove: false,
        },
      }),
      101,
    )
    expect(view.kind).toBe('unable_to_evaluate')
    if (view.kind !== 'unable_to_evaluate') return
    expect(view.summary).toContain('desfocada')
    expect(view.improvements.length).toBeGreaterThan(0)
    expect(view.showRetry).toBe(true)
    expect(view.humanChoicesEnabled).toBe(true)
    expect(view.autoResult).toBeNull()
  })

  it('D. skipped não mostra UI de IA', () => {
    const dto: VisualVerifyDto = {
      skipped: true,
      reason: 'visual_verify_disabled',
      status: null,
      summary: null,
      improvements: [],
      mayAutoApprove: false,
    }
    expect(isVisualVerifySkipped(dto)).toBe(true)
    const view = buildVisualVerifyView(slot({ status: 'ready', dto }), 101)
    expect(view.kind).toBe('hidden')
  })

  it('E. falha HTTP/provider não altera resultado humano e preserva evidência', () => {
    const view = buildVisualVerifyView(
      slot({
        status: 'error',
        dto: null,
        error: 'Não foi possível verificar a evidência agora.',
      }),
      101,
    )
    expect(view.kind).toBe('network_error')
    if (view.kind !== 'network_error') return
    expect(view.message).toContain('Não foi possível verificar')
    expect(view.showRetryPhoto).toBe(true)
    expect(view.humanChoicesEnabled).toBe(true)
    expect(view.autoResult).toBeNull()
  })

  it('F. resposta antiga não substitui avaliação da evidência nova', () => {
    const current = slot({
      itemId: 10,
      evidenceId: 202,
      seq: 2,
      status: 'loading',
      dto: null,
    })
    expect(
      shouldIgnoreVerifyResponse({
        slot: current,
        itemId: 10,
        evidenceId: 101,
        seq: 1,
      }),
    ).toBe(true)
    expect(
      shouldIgnoreVerifyResponse({
        slot: current,
        itemId: 10,
        evidenceId: 202,
        seq: 2,
      }),
    ).toBe(false)

    const afterOk = buildVisualVerifyView(
      { ...current, status: 'ready', dto: { status: 'ok', summary: 'ok', mayAutoApprove: false } },
      202,
    )
    expect(afterOk.kind).toBe('ok')
    expect(latestEvidenceId([{ id: 101 }, { id: 202 }])).toBe(202)
    expect(buildVisualVerifyView({ ...current, evidenceId: 101 }, 202).kind).toBe('hidden')
  })

  it('nunca interpreta mayAutoApprove como clique automático', () => {
    const view = buildVisualVerifyView(
      slot({
        status: 'ready',
        dto: { ...NEEDS_IMPROVEMENT, mayAutoApprove: false },
      }),
      101,
    )
    expect(view.kind).toBe('needs_improvement')
    if (view.kind !== 'needs_improvement') return
    expect(view.autoResult).toBeNull()
    expect(view.humanChoicesEnabled).toBe(true)
  })
})
