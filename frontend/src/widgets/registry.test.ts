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
      expect(['sm', 'lg']).toContain(w.size)
      expect(w.component).toBeTruthy()
      expect(Array.isArray(w.queryKeys)).toBe(true)
      if (typeof w.drillDown === 'string') expect(w.drillDown.startsWith('/')).toBe(true)
    }
  })

  it('registers all nine dashboard tiles', () => {
    const keys = WIDGETS.map((w) => w.key)
    expect(keys).toEqual([
      'email',
      'chat',
      'revops',
      'pipeline',
      'industryFeed',
      'qtrEvent',
      'ouFeedback',
      'territory',
      'ebc',
    ])
  })
})
