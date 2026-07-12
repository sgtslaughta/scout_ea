import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResponseDetailModal } from './ResponseDetailModal'
import type { Signal, Alert } from '@/api'

const signal: Signal = {
  id: 1, type: 'email', source: 'inbox', source_skill: 'triage_teams',
  title: 'Budget review', status: 'new', priority: 1, created_at: '2026-07-12T09:00:00Z',
  who: 'Mike', what: 'wants RVP in launch review', when_rel: 'today', why: 'exec ask',
  reasoning: 'Flagged: exec sender + deadline language.',
}

function renderSignal(overrides: Partial<Signal> = {}, onStatus = vi.fn()) {
  return render(
    <ResponseDetailModal open kind="signal" item={{ ...signal, ...overrides }}
      onClose={() => {}} onStatus={onStatus} />,
  )
}

describe('ResponseDetailModal', () => {
  it('renders all five W values for a signal', () => {
    renderSignal()
    expect(screen.getByText('Mike')).toBeInTheDocument()
    expect(screen.getByText('wants RVP in launch review')).toBeInTheDocument()
    expect(screen.getByText('today')).toBeInTheDocument()
    expect(screen.getByText('exec ask')).toBeInTheDocument()
  })

  it('shows the stored reasoning', () => {
    renderSignal()
    expect(screen.getByText(/Flagged: exec sender/)).toBeInTheDocument()
  })

  it('falls back to source_skill/why when reasoning is absent', () => {
    renderSignal({ reasoning: undefined })
    expect(screen.getByText(/Flagged by triage_teams/)).toBeInTheDocument()
  })

  it('dims a missing W field', () => {
    renderSignal({ who: undefined })
    // the WHO cell renders an em-dash placeholder
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('Silence and Dismiss call onStatus', () => {
    const onStatus = vi.fn()
    renderSignal({}, onStatus)
    fireEvent.click(screen.getByRole('button', { name: /silence/i }))
    expect(onStatus).toHaveBeenCalledWith('read')
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onStatus).toHaveBeenCalledWith('dismissed')
  })

  it('alert variant hides the 5W grid', () => {
    const alert: Alert = {
      id: 2, severity: 'warning', title: 'Disk almost full', body: '92% used',
      status: 'unread', created_at: '2026-07-12T09:00:00Z',
    }
    render(<ResponseDetailModal open kind="alert" item={alert} onClose={() => {}} onStatus={vi.fn()} />)
    expect(screen.getByText('92% used')).toBeInTheDocument()
    expect(screen.queryByText('WHO')).toBeNull()
  })
})
