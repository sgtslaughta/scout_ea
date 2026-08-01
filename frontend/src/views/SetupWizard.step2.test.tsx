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
    { name: 'triage_email', description: 'Triage inbox', schedule: 'every 5m', body: 'b' },
  ])
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

async function goToSetup() {
  render(<SetupWizard />)
  fireEvent.click(await screen.findByRole('button', { name: /next/i }))
}

describe('Step 2 Set it up', () => {
  it('copies one message that installs everything', async () => {
    await goToSetup()
    fireEvent.click(await screen.findByRole('button', { name: /copy the setup message/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    const pasted = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(pasted).toContain('/api/scout/install')
    expect(pasted).toContain('my-scout')
  })

  // Non-technical users shouldn't meet 24 skill cards before they've done
  // anything -- the list is an answer to "what is this about to do?", not a task.
  it('keeps the skill list collapsed until asked', async () => {
    await goToSetup()
    expect(screen.queryByText('Triage email')).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /what will it set up/i }))
    expect(await screen.findByText('Triage email')).toBeInTheDocument()
    expect(screen.getByText(/every 5m/)).toBeInTheDocument()
  })

  it('confirms once Scout has fetched the bundle', async () => {
    vi.spyOn(api, 'getConfig').mockResolvedValue({
      mcp_name: 'my-scout', install_fetched_at: '2999-01-01T00:00:00.000Z',
    })
    await goToSetup()
    expect(await screen.findByText(/scout picked it up/i, {}, { timeout: 5000 }))
      .toBeInTheDocument()
  })
})
