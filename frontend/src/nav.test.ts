import { describe, it, expect } from 'vitest'
import { NAV, NAV_GROUPS } from './nav'

describe('nav registry', () => {
  it('has exactly 8 items', () => {
    expect(NAV).toHaveLength(8)
  })
  it('has unique ids and paths', () => {
    expect(new Set(NAV.map((n) => n.id)).size).toBe(8)
    expect(new Set(NAV.map((n) => n.path)).size).toBe(8)
  })
  it('home is the root path', () => {
    expect(NAV.find((n) => n.id === 'home')?.path).toBe('/')
  })
  it('every item belongs to a declared group', () => {
    const groups = new Set(NAV_GROUPS.map((g) => g.id))
    for (const n of NAV) expect(groups.has(n.group)).toBe(true)
  })
  it('declares the three consolidated destinations', () => {
    const paths = NAV.map((n) => n.path)
    expect(paths).toEqual(expect.arrayContaining(['/review', '/schedule', '/automations']))
  })
})
