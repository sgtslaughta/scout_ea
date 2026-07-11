import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RouteErrorBoundary from './RouteErrorBoundary'

function Boom(): React.ReactNode {
  throw new Error('view exploded')
}

describe('RouteErrorBoundary', () => {
  it('renders children when they do not throw', () => {
    render(<RouteErrorBoundary><div>ok content</div></RouteErrorBoundary>)
    expect(screen.getByText('ok content')).toBeInTheDocument()
  })

  it('catches a child error and shows a fallback Alert with the message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<RouteErrorBoundary><Boom /></RouteErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent(/view exploded/i)
    spy.mockRestore()
  })

  it('reload button clears the error and re-renders children', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('flaky')
      return <div>recovered</div>
    }
    render(<RouteErrorBoundary><Flaky /></RouteErrorBoundary>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: /reload view/i }))
    expect(screen.getByText('recovered')).toBeInTheDocument()
    spy.mockRestore()
  })
})
