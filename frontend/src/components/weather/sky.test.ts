import { describe, it, expect } from 'vitest'
import { skyPhase, arcFraction } from './sky'

const SR = '2026-06-21T06:00:00Z'
const SS = '2026-06-21T20:00:00Z'
const at = (h: number, m = 0) => `2026-06-21T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`

describe('skyPhase', () => {
  it('day at noon', () => expect(skyPhase(at(13), SR, SS)).toBe('day'))
  it('night before dawn', () => expect(skyPhase(at(3), SR, SS)).toBe('night'))
  it('dawn near sunrise', () => expect(skyPhase(at(6, 10), SR, SS)).toBe('dawn'))
  it('dusk near sunset', () => expect(skyPhase(at(19, 50), SR, SS)).toBe('dusk'))
})

describe('arcFraction', () => {
  it('sunrise -> 0, sunset -> 1 (day)', () => {
    expect(arcFraction(SR, SR, SS, true)).toBeCloseTo(0, 5)
    expect(arcFraction(SS, SR, SS, true)).toBeCloseTo(1, 5)
  })
  it('noon -> 0.5 (day)', () => {
    expect(arcFraction(at(13), SR, SS, true)).toBeCloseTo(0.5, 2)
  })
  it('clamps below 0 / above 1', () => {
    expect(arcFraction(at(5), SR, SS, true)).toBe(0)
    expect(arcFraction(at(21), SR, SS, true)).toBe(1)
  })
  it('night progresses sunset->sunrise', () => {
    const f = arcFraction(at(23), SR, SS, false)
    expect(f).toBeGreaterThan(0)
    expect(f).toBeLessThan(1)
  })
})
