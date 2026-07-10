import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { TodayBriefing } from './TodayBriefing'

// Mock the API
vi.mock('@/api', () => ({
  getOutlook: vi.fn(() => Promise.resolve({
    deadlines: [
      { id: '1', title: 'Meeting 1', countdown_seconds: 3600 },
      { id: '2', title: 'Meeting 2', countdown_seconds: 86400 },
    ],
    tasks_due_today: [
      { id: 'task1', title: 'Task 1' },
      { id: 'task2', title: 'Task 2' },
      { id: 'task3', title: 'Task 3' },
    ],
    proactive: [
      { id: 'proactive1', title: 'Proactive alert 1' },
      { id: 'proactive2', title: 'Proactive alert 2' },
    ],
  })),
  getSignals: vi.fn(() => Promise.resolve([
    { id: 'sig1', title: 'Signal 1', type: 'regular', priority: 0 },
    { id: 'sig2', title: 'Signal 2', type: 'regular', priority: 1 },
    { id: 'sig3', title: 'Signal 3', type: 'regular', priority: 2 },
  ])),
}))

function renderBriefing(open: boolean = true) {
  const onClose = vi.fn()
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <TodayBriefing open={open} onClose={onClose} />
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return onClose
}

describe('TodayBriefing', () => {
  beforeEach(() => {
    localStorage.removeItem('ea-briefing-shown')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    renderBriefing(false)
    expect(screen.queryByText(/TODAY'S BRIEFING/i)).not.toBeInTheDocument()
  })

  it('renders header with TODAY\'S BRIEFING title and current date', async () => {
    renderBriefing(true)
    await waitFor(() => {
      expect(screen.getByText(/TODAY'S BRIEFING/i)).toBeInTheDocument()
    })
    // Date should be formatted
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    expect(screen.getByText(dateStr)).toBeInTheDocument()
  })

  it('renders stats boxes with MUI components', async () => {
    renderBriefing(true)
    await waitFor(() => {
      expect(screen.getByText('MEETINGS')).toBeInTheDocument()
      expect(screen.getByText('DUE TODAY')).toBeInTheDocument()
      expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    })
    // Check numbers render
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders signals section with list items', async () => {
    renderBriefing(true)
    await waitFor(() => {
      expect(screen.getByText('SIGNALS')).toBeInTheDocument()
    })
    expect(screen.getByText('Signal 1')).toBeInTheDocument()
  })

  it('renders proactive section with alerts', async () => {
    renderBriefing(true)
    await waitFor(() => {
      expect(screen.getByText('PROACTIVE')).toBeInTheDocument()
    })
    expect(screen.getByText('Proactive alert 1')).toBeInTheDocument()
  })

  it('renders CTA button', async () => {
    renderBriefing(true)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Start my day/i })).toBeInTheDocument()
    })
  })

  it('renders close button as MUI IconButton with X', async () => {
    renderBriefing(true)
    await waitFor(() => {
      const closeBtn = screen.getByRole('button', { name: /Close briefing/i })
      expect(closeBtn).toBeInTheDocument()
      // MUI IconButton has specific class
      expect(closeBtn.className).toContain('MuiIconButton')
    })
  })

  it('closes on close button click', async () => {
    const onClose = renderBriefing(true)
    const closeBtn = await screen.findByRole('button', { name: /Close briefing/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on CTA button click', async () => {
    const onClose = renderBriefing(true)
    const ctaBtn = await screen.findByRole('button', { name: /Start my day/i })
    fireEvent.click(ctaBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape key', async () => {
    const onClose = renderBriefing(true)
    await waitFor(() => {
      expect(screen.getByText(/TODAY'S BRIEFING/i)).toBeInTheDocument()
    })
    const dialog = document.querySelector('[role="dialog"]')
    if (dialog) {
      fireEvent.keyDown(dialog, { key: 'Escape' })
    }
    expect(onClose).toHaveBeenCalled()
  })

})
