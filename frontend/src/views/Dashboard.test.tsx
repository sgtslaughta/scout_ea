import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { DashboardView } from './Dashboard'
import { WIDGETS } from '../widgets/registry'
import { LAYOUT_KEY } from '../widgets/layout'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes('/api/outlook')
      ? { date: '', deadlines: [], top_trends: [], proactive: [], tasks_due_today: [] }
      : []),
  })))
})

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <DashboardView />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('DashboardView (widget grid)', () => {
  it('renders every registered visible widget title', async () => {
    wrap()
    for (const w of WIDGETS) {
      expect(await screen.findByText(w.title)).toBeInTheDocument()
    }
  })

  it('hide persists to layout storage', async () => {
    wrap()
    const hide = await screen.findByRole('button', { name: /hide deadlines/i })
    fireEvent.click(hide)
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY)!)
      expect(stored.hidden).toContain('deadlines')
    })
    expect(screen.queryByText('Deadlines')).toBeNull()
  })

  it('hidden widgets come back via Add widget menu', async () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ order: WIDGETS.map((w) => w.key), hidden: ['deadlines'] }))
    wrap()
    fireEvent.click(await screen.findByRole('button', { name: /add widget/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /deadlines/i }))
    expect(await screen.findByText('Deadlines')).toBeInTheDocument()
  })

  it('move down persists new order', async () => {
    wrap()
    fireEvent.click(await screen.findByRole('button', { name: /move key metrics down/i }))
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY)!)
      expect(stored.order.indexOf('kpi')).toBe(1)
    })
  })
})
