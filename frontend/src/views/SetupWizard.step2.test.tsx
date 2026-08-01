import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './../api'
import { SetupWizard } from './SetupWizard'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(api, 'getMcpConfig').mockResolvedValue({ url: 'u', token: 't', configured: true })
  vi.spyOn(api, 'getConfig').mockResolvedValue({ mcp_name: 'my-scout' })
  vi.spyOn(api, 'getMcpStatus').mockResolvedValue({ last_seen: null })
  vi.spyOn(api, 'getSkills').mockResolvedValue([
    { name: 'triage_email', description: 'Triage inbox', body: 'Use the {{mcp_name}} MCP server.' },
  ])
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

async function goToSkills() {
  render(<SetupWizard />)
  fireEvent.click(await screen.findByRole('button', { name: /next/i }))
}

describe('Step 2 Skills', () => {
  it('hides body until View and copies with name substituted', async () => {
    await goToSkills()
    expect(await screen.findByText('triage_email')).toBeInTheDocument()
    expect(screen.queryByText(/MCP server\./)).not.toBeInTheDocument()  // body hidden
    fireEvent.click(screen.getByRole('button', { name: /view/i }))
    expect(await screen.findByText(/my-scout MCP server\./)).toBeInTheDocument()
    // Exact: the step also offers "Copy the setup message", which installs
    // every skill at once rather than this one skill's body.
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Use the my-scout MCP server.'))
  })
})
