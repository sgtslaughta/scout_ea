import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedActionsSection } from './FeedActionsSection'
import * as api from '@/api'

const ACTIONS = [
  { id: 1, action_type: 'email_new', mode: 'review', status: 'drafted', created_at: '2026-07-12T09:00:00Z', rationale: 'Send recap' },
  { id: 2, action_type: 'teams_post', mode: 'auto', status: 'completed', created_at: '2026-07-12T08:00:00Z' },
]

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><FeedActionsSection /></QueryClientProvider>)
}

describe('FeedActionsSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'listActions').mockResolvedValue(ACTIONS as never)
  })

  it('renders pending and recent groups', async () => {
    wrap()
    expect(await screen.findByText(/Pending review/)).toBeInTheDocument()
    expect(screen.getByText(/Recent results/)).toBeInTheDocument()
    expect(await screen.findByText('Send recap')).toBeInTheDocument()
  })

  it('approves a pending action', async () => {
    const spy = vi.spyOn(api, 'approveAction').mockResolvedValue({ updated: 1 } as never)
    wrap()
    await screen.findByText('Send recap')
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.calls[0][0]).toBe(1)
  })
})
