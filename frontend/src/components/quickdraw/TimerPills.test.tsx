import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TimersProvider, useTimersContext } from '@/lib/useTimers'
import { TimerPills } from './TimerPills'

beforeEach(() => localStorage.clear())

function Seed() { // helper to add a timer from within the provider
  const t = useTimersContext()
  return <button onClick={() => t.addTimer('Focus', 60_000)}>seed</button>
}

describe('TimerPills', () => {
  it('shows an open button and calls onOpen', () => {
    const onOpen = vi.fn()
    render(<TimersProvider><TimerPills onOpen={onOpen} /></TimersProvider>)
    fireEvent.click(screen.getByRole('button', { name: /timers/i }))
    expect(onOpen).toHaveBeenCalled()
  })
  it('renders a pill for each timer', () => {
    render(<TimersProvider><Seed /><TimerPills onOpen={() => {}} /></TimersProvider>)
    act(() => { fireEvent.click(screen.getByText('seed')) })
    expect(screen.getByText('Focus 01:00')).toBeInTheDocument()
  })
})
