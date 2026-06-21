import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardView } from './Dashboard'
import '@testing-library/jest-dom'

vi.mock('@/api', () => ({
  getOutlook: vi.fn(() =>
    Promise.resolve({
      deadlines: [],
      top_trends: [],
      proactive: [],
      tasks_due_today: [],
    })
  ),
  getDeadlines: vi.fn(() => Promise.resolve([])),
  getTrends: vi.fn(() => Promise.resolve([])),
  getSignals: vi.fn(() => Promise.resolve([])),
  getActivity: vi.fn(() => Promise.resolve([])),
}))

describe('DashboardView', () => {
  it('renders the dashboard', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardView />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Key Metrics/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Skill Activity/i)).toBeInTheDocument()
    expect(screen.getByText(/Trending/i)).toBeInTheDocument()
  })
})
