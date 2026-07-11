import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { RightDrawer } from './RightDrawer'

// Mock the API
vi.mock('@/api', () => ({
  getDeadlines: vi.fn(() => Promise.resolve([
    {
      id: '1',
      title: 'Team Sync',
      countdown_seconds: 3600,
      due_at: new Date(Date.now() + 3600000).toISOString(),
      source: 'calendar',
    },
  ])),
  getTrends: vi.fn(() => Promise.resolve([
    { id: '1', term: 'React', delta: 5, kind: 'search', score: 92, window_start: '2026-07-04', window_end: '2026-07-11' },
    { id: '2', term: 'Vue', delta: -2, kind: 'search', score: 85, window_start: '2026-07-04', window_end: '2026-07-11' },
  ])),
}))

const renderDrawer = () => {
  const queryClient = new QueryClient()
  const theme = createTheme()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <RightDrawer />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RightDrawer', () => {
  describe('deadline rows', () => {
    it('renders deadline items as clickable buttons', async () => {
      renderDrawer()
      await new Promise(resolve => setTimeout(resolve, 100))

      const deadline = screen.getByRole('button', { name: /Team Sync/i })
      expect(deadline).toBeInTheDocument()
      expect(deadline).toHaveAttribute('aria-label', 'Team Sync')
    })
  })

  describe('trend rows', () => {
    it('renders trend items with chip labels', async () => {
      renderDrawer()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('Vue')).toBeInTheDocument()
      expect(screen.getByText('+5%')).toBeInTheDocument()
      expect(screen.getByText('-2%')).toBeInTheDocument()
    })

    it('renders trend items as clickable buttons', async () => {
      renderDrawer()
      await new Promise(resolve => setTimeout(resolve, 100))

      const reactTrend = screen.getByRole('button', { name: /React/i })
      expect(reactTrend).toBeInTheDocument()
      expect(reactTrend).toHaveAttribute('aria-label', 'React')
    })
  })
})
