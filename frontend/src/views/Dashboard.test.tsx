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

  it('Manage widgets menu toggles visibility and persists', async () => {
    wrap()
    const btn = await screen.findByRole('button', { name: /manage widgets/i })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    // every widget listed
    const items = await screen.findAllByRole('menuitemcheckbox')
    expect(items.length).toBe(WIDGETS.length)
    // hide the first widget
    fireEvent.click(items[0])
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY)!)
      expect(stored.hidden.length).toBe(1)
    })
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
