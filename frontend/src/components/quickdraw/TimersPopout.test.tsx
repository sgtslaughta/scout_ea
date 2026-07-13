import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimersProvider } from '@/lib/useTimers'
import { TimersPopout } from './TimersPopout'

beforeEach(() => localStorage.clear())

describe('TimersPopout', () => {
  it('renders the timers panel without a popout button (already in popout)', () => {
    render(<TimersProvider><TimersPopout /></TimersProvider>)
    expect(screen.getByText('Timers')).toBeInTheDocument()               // heading
    expect(screen.queryByRole('button', { name: /popout/i })).toBeNull() // showPopout=false
    expect(screen.getByRole('button', { name: 'add timer' })).toBeInTheDocument()
  })
})
