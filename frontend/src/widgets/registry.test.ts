import { describe, it, expect } from 'vitest'
import { WIDGETS } from './registry'

describe('widget registry', () => {
  it('has unique keys', () => {
    const keys = WIDGETS.map((w) => w.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every entry is complete', () => {
    for (const w of WIDGETS) {
      expect(w.key).toBeTruthy()
      expect(w.title).toBeTruthy()
      expect(['sm', 'md', 'lg']).toContain(w.size)
      expect(w.component).toBeTruthy()
      expect(Array.isArray(w.queryKeys)).toBe(true)
      if (w.drillDown) expect(w.drillDown.startsWith('/')).toBe(true)
    }
  })
})
