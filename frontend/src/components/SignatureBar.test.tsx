import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '../theme'
import { SignatureBar } from './SignatureBar'
import * as api from '@/api'
import type { Deadline } from '@/api'

function mkDeadline(p: Partial<Deadline>): Deadline {
  return { id: 1, title: 'D', due_at: new Date().toISOString(), countdown_seconds: 3600, detail: '', source: 'manual', status: 'open', visible: 1, ...p }
}

function renderBar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        <MemoryRouter><SignatureBar /></MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('SignatureBar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getDeadlines').mockResolvedValue([])
  })

  it('toggles color mode via useColorScheme', () => {
    localStorage.setItem('ea-theme', 'dark')
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: /switch to light mode/i }))
    expect(localStorage.getItem('ea-theme')).toBe('light')
  })

  it('shows brand and command palette trigger', () => {
    renderBar()
    expect(screen.getByText('SCOUT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open command palette/i })).toBeInTheDocument()
  })

  it('plots a deadline due today as a dot', async () => {
    const today = new Date(); today.setHours(15, 0, 0, 0)
    vi.spyOn(api, 'getDeadlines').mockResolvedValue([
      mkDeadline({ id: 7, title: 'Ship it', due_at: today.toISOString(), countdown_seconds: 3600 }),
    ])
    renderBar()
    expect(await screen.findByRole('button', { name: /Ship it/i })).toBeInTheDocument()
  })

  it('summarizes future deadlines in a later cluster', async () => {
    const future = new Date(Date.now() + 3 * 86400 * 1000)
    vi.spyOn(api, 'getDeadlines').mockResolvedValue([
      mkDeadline({ id: 8, title: 'Next week', due_at: future.toISOString(), countdown_seconds: 3 * 86400 }),
    ])
    renderBar()
    expect(await screen.findByRole('button', { name: /1 later deadlines/i })).toBeInTheDocument()
  })
})
