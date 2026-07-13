import { describe, it, expect, vi, afterEach } from 'vitest'
import { getWeather } from './api'
afterEach(() => vi.restoreAllMocks())

describe('getWeather', () => {
  it('hits /api/weather with coords', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: true, json: () => Promise.resolve({ condition: 'clear' }) }))
    const out = await getWeather(40.71, -74.01)
    expect(out.condition).toBe('clear')
    expect(fetch).toHaveBeenCalledWith('/api/weather?lat=40.71&lon=-74.01')
  })
})
