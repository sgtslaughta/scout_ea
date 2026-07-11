import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ActivityView } from './Activity'
import * as api from '@/api'

describe('Activity view', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.restoreAllMocks()
  })

  function renderView() {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ActivityView />
        </QueryClientProvider>
      </BrowserRouter>
    )
  }

  it('renders activity rows', async () => {
    vi.spyOn(api, 'getActivity').mockResolvedValue([
      { id: 1, skill: 'daily-brief', ran_at: '2026-07-11T07:00:00Z', items_created: 3, status: 'ok', note: 'fine' },
    ])
    renderView()
    expect(await screen.findByText('daily-brief')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
