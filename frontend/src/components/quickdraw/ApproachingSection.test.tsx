import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '../../theme'
import { ApproachingSection } from './ApproachingSection'
import * as api from '@/api'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  const soon = new Date(Date.now() + 3600_000).toISOString()
  vi.spyOn(api, 'getDeadlines').mockResolvedValue([{ id: 1, title: 'Ship it', due_at: soon, countdown_seconds: 3600, detail: '', source: 'manual', status: 'open', visible: 1 }])
  vi.spyOn(api, 'getTasks').mockResolvedValue([])
  vi.spyOn(api, 'getEvents').mockResolvedValue([])
})

describe('ApproachingSection', () => {
  it('lists an approaching deadline with a countdown', async () => {
    wrap(<ApproachingSection expanded collapsed={false} onToggle={vi.fn()} />)
    expect(await screen.findByText('Ship it')).toBeInTheDocument()
  })
})
