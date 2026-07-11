import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DocsView } from './Docs'
import * as api from '@/api'

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><DocsView /></QueryClientProvider>)
}

beforeEach(() => vi.restoreAllMocks())

describe('DocsView', () => {
  it('renders skills as grid rows with copy action', async () => {
    vi.spyOn(api, 'getSkills').mockResolvedValue([
      { name: 'daily-brief', description: 'Morning summary', schedule: '0 7 * * *', body: 'BODY' },
    ])
    renderView()
    expect(await screen.findByText('daily-brief')).toBeInTheDocument()
    expect(screen.getByLabelText('Copy daily-brief to clipboard')).toBeInTheDocument()
  })
})
