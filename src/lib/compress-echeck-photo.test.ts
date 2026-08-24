import { describe, expect, it } from 'vitest'
import { computeResizeDimensions, ECHECK_PHOTO_MAX_SIDE } from '@/lib/compress-echeck-photo'

describe('computeResizeDimensions', () => {
  it('keeps small images unchanged', () => {
    expect(computeResizeDimensions(800, 600)).toEqual({
      width: 800,
      height: 600,
      scaled: false,
    })
  })

  it('scales landscape 4032x3024 to max side 1920', () => {
    const r = computeResizeDimensions(4032, 3024, ECHECK_PHOTO_MAX_SIDE)
    expect(r.scaled).toBe(true)
    expect(r.width).toBe(1920)
    expect(r.height).toBe(1440)
  })

  it('scales portrait preserving aspect', () => {
    const r = computeResizeDimensions(3024, 4032, 1600)
    expect(r.scaled).toBe(true)
    expect(r.height).toBe(1600)
    expect(r.width).toBe(1200)
  })

  it('handles sort_order-0 style edge (1x1)', () => {
    expect(computeResizeDimensions(1, 1).scaled).toBe(false)
  })
})
