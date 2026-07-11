import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SkillsView } from './Skills'
import * as api from '@/api'

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><SkillsView /></QueryClientProvider>)
}

beforeEach(() => vi.restoreAllMocks())

describe('SkillsView', () => {
  it('renders skills as grid rows with copy action', async () => {
    vi.spyOn(api, 'getSkills').mockResolvedValue([
      { name: 'daily-brief', description: 'Morning summary', schedule: '0 7 * * *', body: 'BODY' },
    ])
    renderView()
    expect(await screen.findByText('daily-brief')).toBeInTheDocument()
    expect(screen.getByLabelText('Copy daily-brief to clipboard')).toBeInTheDocument()
  })

  it('shows Active/Idle status from the active flag', async () => {
    vi.spyOn(api, 'getSkills').mockResolvedValue([
      { name: 'fresh', description: 'x', schedule: 'heartbeat 30m', body: 'B', active: true, last_run: '2026-07-12T11:50:00Z' },
      { name: 'stale', description: 'y', schedule: 'daily', body: 'B', active: false, last_run: null },
    ])
    renderView()
    expect(await screen.findByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })

  it('opens a detail modal with full body on row click', async () => {
    vi.spyOn(api, 'getSkills').mockResolvedValue([
      { name: 'daily-brief', description: 'Morning summary', schedule: '0 7 * * *', body: 'FULL SKILL BODY' },
    ])
    renderView()
    await userEvent.click(await screen.findByText('daily-brief'))
    expect(await screen.findByText('FULL SKILL BODY')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument()
  })
})
