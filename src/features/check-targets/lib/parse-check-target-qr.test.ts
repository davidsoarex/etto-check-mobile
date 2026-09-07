import { describe, expect, it } from 'vitest'
import { parseCheckTargetQr, parseCheckTargetQrMessage } from './parse-check-target-qr'

describe('parseCheckTargetQr', () => {
  it('accepts production deep link', () => {
    const r = parseCheckTargetQr('https://check.etto.one/t/abc_Token-12.34~x')
    expect(r).toEqual({ ok: true, token: 'abc_Token-12.34~x' })
  })

  it('accepts path-only /t/token', () => {
    expect(parseCheckTargetQr('/t/opaque-token-value')).toEqual({
      ok: true,
      token: 'opaque-token-value',
    })
  })

  it('accepts host without scheme', () => {
    expect(parseCheckTargetQr('check.etto.one/t/opaque-token-value')).toEqual({
      ok: true,
      token: 'opaque-token-value',
    })
  })

  it('accepts localhost smoke URL', () => {
    expect(parseCheckTargetQr('http://localhost:5175/t/opaque-token-value')).toEqual({
      ok: true,
      token: 'opaque-token-value',
    })
  })

  it('rejects empty', () => {
    expect(parseCheckTargetQr('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects unrelated URL', () => {
    expect(parseCheckTargetQr('https://example.com/t/foo')).toEqual({
      ok: false,
      reason: 'not_echeck_qr',
    })
  })

  it('rejects random barcode text (no /t/)', () => {
    expect(parseCheckTargetQr('7891234567890')).toEqual({ ok: false, reason: 'not_echeck_qr' })
  })

  it('rejects bare opaque token without /t/', () => {
    expect(parseCheckTargetQr('opaque-token-value-alone')).toEqual({
      ok: false,
      reason: 'not_echeck_qr',
    })
  })

  it('rejects too-short token', () => {
    expect(parseCheckTargetQr('https://check.etto.one/t/short')).toEqual({
      ok: false,
      reason: 'invalid_token',
    })
  })

  it('message for not_echeck_qr is clear', () => {
    const msg = parseCheckTargetQrMessage({ ok: false, reason: 'not_echeck_qr' })
    expect(msg).toMatch(/não é de um local ou equipamento/i)
  })
})
