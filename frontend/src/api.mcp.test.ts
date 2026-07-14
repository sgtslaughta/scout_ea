import { describe, it, expect, vi, afterEach } from 'vitest'
import { getMcpConfig, getMcpStatus } from './api'

afterEach(() => vi.restoreAllMocks())

function mockFetch(json: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200, statusText: 'OK', json: async () => json,
  }))
}

describe('mcp api', () => {
  it('getMcpConfig hits /api/mcp/config', async () => {
    mockFetch({ url: 'http://localhost:8766/mcp', token: 't', configured: true })
    const c = await getMcpConfig()
    expect(c.url).toContain('/mcp')
    expect(fetch).toHaveBeenCalledWith('/api/mcp/config')
  })
  it('getMcpStatus returns last_seen', async () => {
    mockFetch({ last_seen: null })
    expect((await getMcpStatus()).last_seen).toBeNull()
  })
})
