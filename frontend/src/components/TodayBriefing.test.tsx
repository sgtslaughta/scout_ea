import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { TodayBriefing } from './TodayBriefing'
import * as api from '@/api'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

const payload = {
  date: '2026-07-12', summary: 'busy day',
  critical: [{ id: 5, title: 'Ship it', kind: 'deadline', nav: { view: '/tasks', id: 5 },
    countdown_seconds: 3600 }],
  risks: [{ id: 1, type: 'proactive', source: 'briefing', title: 'Renewal risk',
    status: 'new', priority: 3, created_at: '', polarity: 'risk' }],
  opportunities: [],
  news_by_topic: [{ topic_id: 10, topic_name: 'AI', topic_priority: 1,
    items: [{ id: 2, title: 'Big model', status: 'new', category: 'news' }] }],
  people: [{ id: 3, name: 'Jane', importance: 5, active: 1, signals: [] }],
  weather: null, finance: null,
}

function renderModal() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TodayBriefing open onClose={() => {}} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TodayBriefing', () => {
  beforeEach(() => vi.spyOn(api, 'getBriefing').mockResolvedValue(payload as never))

  it('renders summary + all section headers + items', async () => {
    renderModal()
    expect(await screen.findByText('busy day')).toBeInTheDocument()
    expect(screen.getByText(/CRITICAL/i)).toBeInTheDocument()
    expect(screen.getByText(/RISKS/i)).toBeInTheDocument()
    expect(screen.getByText('Ship it')).toBeInTheDocument()
    expect(screen.getByText('Renewal risk')).toBeInTheDocument()
    expect(screen.getByText('Jane')).toBeInTheDocument()
  })

  it('click-to-nav closes modal and routes', async () => {
    const onClose = vi.fn()
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><TodayBriefing open onClose={onClose} /></MemoryRouter>
      </QueryClientProvider>,
    )
    await userEvent.click(await screen.findByText('Ship it'))
    expect(navigateMock).toHaveBeenCalledWith('/tasks')
    expect(onClose).toHaveBeenCalled()
  })
})
