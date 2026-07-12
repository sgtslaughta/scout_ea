import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedInboxSection } from './FeedInboxSection'
import * as api from '@/api'

const SIGNALS = [
  { id: 1, type: 'email', source: 'inbox', title: 'New one', status: 'new', priority: 1, created_at: '2026-07-12T09:00:00Z', why: 'r1' },
  { id: 2, type: 'proactive', source: 'skill', title: 'Triaged one', status: 'triaged', priority: 3, created_at: '2026-07-12T08:00:00Z', why: 'r2' },
]

function wrap(path = '/feed?view=inbox') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}><FeedInboxSection /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FeedInboxSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getSignals').mockResolvedValue(SIGNALS as never)
  })

  it('shows all statuses by default', async () => {
    wrap()
    expect(await screen.findByText('New one')).toBeInTheDocument()
    expect(screen.getByText('Triaged one')).toBeInTheDocument()
  })

  it('a status chip filters the list', async () => {
    wrap()
    await screen.findByText('New one')
    fireEvent.click(screen.getByRole('button', { name: 'triaged' }))
    expect(screen.queryByText('New one')).toBeNull()
    expect(screen.getByText('Triaged one')).toBeInTheDocument()
  })

  it('preselects the status chip from ?status=', async () => {
    wrap('/feed?view=inbox&status=triaged')
    await screen.findByText('Triaged one')
    expect(screen.queryByText('New one')).toBeNull()
  })

  it('opens ResponseDetailModal when a signal title is clicked', async () => {
    wrap()
    const title = await screen.findByText('New one')
    fireEvent.click(title)
    await waitFor(() => expect(screen.getByText('AI Reasoning')).toBeInTheDocument())
  })

  it('proactive toggle shows only proactive-type signals', async () => {
    wrap()
    await screen.findByText('New one')
    fireEvent.click(screen.getByRole('button', { name: 'proactive' }))
    expect(screen.queryByText('New one')).toBeNull() // email type hidden
    expect(screen.getByText('Triaged one')).toBeInTheDocument() // proactive type shown
  })

  it('re-clicking an active status chip clears the filter', async () => {
    wrap()
    await screen.findByText('New one')
    const chip = screen.getByRole('button', { name: 'triaged' })
    fireEvent.click(chip) // filter to triaged
    expect(screen.queryByText('New one')).toBeNull()
    fireEvent.click(chip) // clear → all shown
    expect(screen.getByText('New one')).toBeInTheDocument()
    expect(screen.getByText('Triaged one')).toBeInTheDocument()
  })

  it('preselects proactive from ?type=proactive', async () => {
    wrap('/feed?view=inbox&type=proactive')
    await screen.findByText('Triaged one')
    expect(screen.queryByText('New one')).toBeNull()
  })
})
