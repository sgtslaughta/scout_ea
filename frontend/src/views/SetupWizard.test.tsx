import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './../api'
import { SetupWizard } from './SetupWizard'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(api, 'getMcpConfig').mockResolvedValue({ url: 'http://localhost:8766/mcp', token: 'tok', configured: true })
  vi.spyOn(api, 'getConfig').mockResolvedValue({ mcp_name: 'scout-ea' })
  vi.spyOn(api, 'setConfig').mockResolvedValue({ key: 'mcp_name', value: 'x' })
  vi.spyOn(api, 'getMcpStatus').mockResolvedValue({ last_seen: null })
})

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
