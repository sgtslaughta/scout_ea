import { render, screen, fireEvent } from '@testing-library/react'
import { vi, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/chime', () => ({ playChime: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { TimersSection } from './TimersSection'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); localStorage.clear() })
afterEach(() => { vi.useRealTimers() })

it('shows default 05:00 countdown and controls when idle', () => {
  render(<TimersSection collapsed={false} onToggle={() => {}} />)
  expect(screen.getByText('05:00')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /start/i }).length).toBeGreaterThan(0)
})

it('preset chip sets the countdown display', () => {
  render(<TimersSection collapsed={false} onToggle={() => {}} />)
  fireEvent.click(screen.getByLabelText('set 10 minutes'))
  expect(screen.getByText('10:00')).toBeInTheDocument()
})
