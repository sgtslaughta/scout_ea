import { describe, it, expect, vi, afterEach } from 'vitest'
import { getFinance } from './api'
afterEach(() => vi.restoreAllMocks())

describe('getFinance', () => {
  it('hits /api/finance', async () => {
    const payload = { watchlist: [{ symbol: 'AAPL', price: 102, change_pct: 2 }], indices: [], stale: false }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: true, json: () => Promise.resolve(payload) }))
    const out = await getFinance()
    expect(out.watchlist[0].symbol).toBe('AAPL')
    expect(fetch).toHaveBeenCalledWith('/api/finance')
  })
})
