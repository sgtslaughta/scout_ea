import { describe, it, expect, vi, afterEach } from 'vitest'
import { getBriefing } from './api'

afterEach(() => vi.restoreAllMocks())

describe('getBriefing', () => {
  it('fetches /api/briefing', async () => {
    const payload = { date: '2026-07-12', summary: 'hi', critical: [], risks: [],
      opportunities: [], news_by_topic: [], people: [], weather: null, finance: null }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: true, json: () => Promise.resolve(payload) }))
    const out = await getBriefing()
    expect(out.summary).toBe('hi')
    expect(fetch).toHaveBeenCalledWith('/api/briefing')
  })
})
