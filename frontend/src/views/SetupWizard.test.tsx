import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './../api'
import { SetupWizard } from './SetupWizard'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(api, 'getMcpConfig').mockResolvedValue({ url: 'http://localhost:8766/mcp', token: 'tok', configured: true })
  vi.spyOn(api, 'getConfig').mockResolvedValue({ mcp_name: 'scout-ea' })
  vi.spyOn(api, 'setConfig').mockResolvedValue({ key: 'mcp_name', value: 'x' })
  vi.spyOn(api, 'getMcpStatus').mockResolvedValue({ last_seen: null })
  vi.spyOn(api, 'getSkills').mockResolvedValue([])
})

describe('SetupWizard', () => {
  // Two steps: connect Scout, then paste one message. The old third step made
  // the user hand-build an automation per skill; the pasted message does that.
  it('shows two step labels', () => {
    render(<SetupWizard />)
    expect(screen.getByText('Connect Scout')).toBeInTheDocument()
    expect(screen.getByText('Set it up')).toBeInTheDocument()
  })

  it('Finish marks wizard_done', async () => {
    render(<SetupWizard />)
    fireEvent.click(await screen.findByRole('button', { name: /next/i }))
    fireEvent.click(await screen.findByRole('button', { name: /finish/i }))
    await waitFor(() => expect(api.setConfig).toHaveBeenCalledWith('wizard_done', '1'))
  })
  it('advances with Next', () => {
    render(<SetupWizard />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    // step index moves; Back becomes enabled
    expect(screen.getByRole('button', { name: /back/i })).toBeEnabled()
  })
})
