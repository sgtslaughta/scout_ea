import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAlerts } from './api'

afterEach(() => vi.restoreAllMocks())

describe('getAlerts', () => {
  it('GETs /api/alerts and returns the rows', async () => {
    const rows = [{ id: 1, severity: 'critical', title: 'Disk full', status: 'unread', created_at: '2026-07-11T10:00:00Z' }]
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const out = await getAlerts()
    expect(spy).toHaveBeenCalledWith('/api/alerts')
    expect(out[0].title).toBe('Disk full')
  })
})
