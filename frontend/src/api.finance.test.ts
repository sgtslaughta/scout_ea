import { describe, it, expect, vi, afterEach } from 'vitest'
import { getFinance, getFinanceHistory } from './api'
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

describe('getFinanceHistory', () => {
  it('requests the symbol and range', async () => {
    const payload = { symbol: 'AAPL', range: '5d', points: [1, 2, 3] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: true, json: () => Promise.resolve(payload) }))
    const out = await getFinanceHistory('AAPL', '5d')
    expect(out.points).toEqual([1, 2, 3])
    expect(fetch).toHaveBeenCalledWith('/api/finance/history?symbol=AAPL&range=5d')
  })
})
