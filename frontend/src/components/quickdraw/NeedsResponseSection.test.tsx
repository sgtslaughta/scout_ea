import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '../../theme'
import { NeedsResponseSection } from './NeedsResponseSection'
import * as api from '@/api'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.spyOn(api, 'getSignals').mockResolvedValue([{ id: 1, type: 'email', source: 'inbox', title: 'Budget question', status: 'new', priority: 2, created_at: '', summary: 'needs a reply' }])
  vi.spyOn(api, 'getAlerts').mockResolvedValue([{ id: 9, severity: 'info', title: 'read one', status: 'read', created_at: '' }])
})

describe('NeedsResponseSection', () => {
  it('lists new signals + unread alerts and silences via status endpoint', async () => {
    const setStatus = vi.spyOn(api, 'setSignalStatus').mockResolvedValue({ updated: 1 })
    wrap(<NeedsResponseSection expanded collapsed={false} onToggle={vi.fn()} />)
    await screen.findByText('Budget question')
    expect(screen.queryByText('read one')).toBeNull() // alert filtered out (status read)
    fireEvent.click(screen.getByRole('button', { name: 'Silence' }))
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('signals', 1, 'read'))
  })

  it('opens the detail modal on item click with the full signal', async () => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getSignals').mockResolvedValue([
      { id: 7, type: 'email', source: 'inbox', title: 'Budget review', status: 'new',
        priority: 1, created_at: '2026-07-12T09:00:00Z', who: 'Mike', why: 'exec ask' },
    ])
    vi.spyOn(api, 'getAlerts').mockResolvedValue([])
    wrap(<NeedsResponseSection expanded collapsed={false} onToggle={vi.fn()} />)
    const item = await screen.findByRole('button', { name: 'Budget review' })
    fireEvent.click(item)
    // "AI Reasoning" heading is rendered ONLY by the modal, never by the list row
    await waitFor(() => expect(screen.getByText('AI Reasoning')).toBeInTheDocument())
  })
})
