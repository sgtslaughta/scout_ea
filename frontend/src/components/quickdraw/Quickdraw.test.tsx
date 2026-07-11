import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TimePrefsProvider } from '@/lib/timePrefs'
import { theme } from '../../theme'
import { Quickdraw } from './Quickdraw'
import * as api from '@/api'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        <TimePrefsProvider><MemoryRouter><Quickdraw /></MemoryRouter></TimePrefsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(api, 'getSignals').mockResolvedValue([])
  vi.spyOn(api, 'getAlerts').mockResolvedValue([])
  vi.spyOn(api, 'getDeadlines').mockResolvedValue([])
  vi.spyOn(api, 'getTasks').mockResolvedValue([])
  vi.spyOn(api, 'getEvents').mockResolvedValue([])
  vi.spyOn(api, 'getActivity').mockResolvedValue([])
})

describe('Quickdraw', () => {
  it('renders masthead + the three sections', async () => {
    wrap()
    expect(screen.getByText('QUICKDRAW')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /needs response/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approaching/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recent activity/i })).toBeInTheDocument()
  })

  it('expand toggle persists', () => {
    wrap()
    fireEvent.click(screen.getByRole('button', { name: /expand quickdraw/i }))
    expect(localStorage.getItem('ea-quickdraw-expanded')).toBe('1')
  })
})
