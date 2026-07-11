import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { CalendarView } from './Calendar'
import * as api from '@/api'

vi.mock('@/api', async (orig) => ({ ...(await orig<typeof api>()) }))

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter><CalendarView /></BrowserRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.restoreAllMocks())

describe('Calendar view', () => {
  it('renders events as grid rows', async () => {
    vi.spyOn(api, 'getEvents').mockResolvedValue([
      { id: 1, title: 'Sync', body: 'weekly', chosen_time: '2026-07-12T10:00', status: 'confirmed' },
      { id: 2, title: 'Review', proposed_times: '["9am","10am"]', attendees: '["a","b"]', status: 'suggested' },
    ] as any)
    renderView()
    expect(await screen.findByText('Sync')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('shows approve/reject only for suggested events', async () => {
    vi.spyOn(api, 'getEvents').mockResolvedValue([
      { id: 2, title: 'Review', status: 'suggested' },
    ] as any)
    renderView()
    await screen.findByText('Review')
    await waitFor(() => expect(screen.getByLabelText('Approve')).toBeInTheDocument())
  })
})
