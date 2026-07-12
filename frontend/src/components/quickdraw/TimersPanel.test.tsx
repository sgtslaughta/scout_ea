import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimersProvider } from '@/lib/useTimers'
import { TimersPanel } from './TimersPanel'

const wrap = (node: React.ReactNode) => render(<TimersProvider>{node}</TimersProvider>)
beforeEach(() => localStorage.clear())

describe('TimersPanel', () => {
  it('adds a timer via a preset chip', () => {
    wrap(<TimersPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'set 5 minutes' }))
    expect(screen.getByText('05:00')).toBeInTheDocument()
  })
  it('adds a timer with a custom minutes value', () => {
    wrap(<TimersPanel />)
    fireEvent.change(screen.getByLabelText('custom minutes'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'add timer' }))
    expect(screen.getByText('03:00')).toBeInTheDocument()
  })
  it('toggles the continuous alarm setting', () => {
    wrap(<TimersPanel />)
    const toggle = screen.getByRole('checkbox', { name: /continuous alarm/i })
    expect(toggle).toBeChecked()          // default on
    fireEvent.click(toggle)
    expect(toggle).not.toBeChecked()
  })
  it('popout button opens a new window', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    wrap(<TimersPanel />)
    fireEvent.click(screen.getByRole('button', { name: /popout/i }))
    expect(open).toHaveBeenCalledWith('/timers', 'ea-timers', expect.stringContaining('width'))
  })
  it('hides the popout button when showPopout is false', () => {
    wrap(<TimersPanel showPopout={false} />)
    expect(screen.queryByRole('button', { name: /popout/i })).toBeNull()
  })
})
