import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useQuickLinks } from './useQuickLinks'
import * as api from '@/api'

vi.mock('@/api')

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('useQuickLinks', () => {
  it('sorts links case-insensitively by name regardless of stored order', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([
      { name: 'zeta', url: 'https://zeta.example' },
      { name: 'Alpha', url: 'https://alpha.example' },
      { name: 'beta', url: 'https://beta.example' },
    ])
    const { result } = renderHook(() => useQuickLinks(), { wrapper })
    await waitFor(() => expect(result.current.links).toHaveLength(3))
    expect(result.current.links.map((l) => l.name)).toEqual(['Alpha', 'beta', 'zeta'])
  })

  it('addLink appends and saves the full array', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([{ name: 'Alpha', url: 'https://alpha.example' }])
    vi.mocked(api.saveQuickLinks).mockResolvedValue(undefined)
    const { result } = renderHook(() => useQuickLinks(), { wrapper })
    await waitFor(() => expect(result.current.links).toHaveLength(1))

    await act(async () => {
      await result.current.addLink({ name: 'Beta', url: 'https://beta.example' })
    })

    expect(api.saveQuickLinks).toHaveBeenCalledWith([
      { name: 'Alpha', url: 'https://alpha.example' },
      { name: 'Beta', url: 'https://beta.example' },
    ])
  })

  it('removeLink drops the matching link and saves', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([
      { name: 'Alpha', url: 'https://alpha.example' },
      { name: 'Beta', url: 'https://beta.example' },
    ])
    vi.mocked(api.saveQuickLinks).mockResolvedValue(undefined)
    const { result } = renderHook(() => useQuickLinks(), { wrapper })
    await waitFor(() => expect(result.current.links).toHaveLength(2))

    await act(async () => {
      await result.current.removeLink('Alpha')
    })

    expect(api.saveQuickLinks).toHaveBeenCalledWith([{ name: 'Beta', url: 'https://beta.example' }])
  })

  it('editLink replaces the link at the given original name and saves', async () => {
    vi.mocked(api.getQuickLinks).mockResolvedValue([{ name: 'Alpha', url: 'https://alpha.example' }])
    vi.mocked(api.saveQuickLinks).mockResolvedValue(undefined)
    const { result } = renderHook(() => useQuickLinks(), { wrapper })
    await waitFor(() => expect(result.current.links).toHaveLength(1))

    await act(async () => {
      await result.current.editLink('Alpha', { name: 'Alpha2', url: 'https://alpha2.example' })
    })

    expect(api.saveQuickLinks).toHaveBeenCalledWith([{ name: 'Alpha2', url: 'https://alpha2.example' }])
  })
})
