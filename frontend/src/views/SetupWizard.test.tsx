import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SetupWizard } from './SetupWizard'

describe('SetupWizard', () => {
  it('shows three step labels', () => {
    render(<SetupWizard />)
    expect(screen.getByText('Connect')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Automations')).toBeInTheDocument()
  })
  it('advances with Next', () => {
    render(<SetupWizard />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    // step index moves; Back becomes enabled
    expect(screen.getByRole('button', { name: /back/i })).toBeEnabled()
  })
})
