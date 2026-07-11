import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { ActionComposeModal } from './ActionComposeModal'

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
import { toast } from 'sonner'

afterEach(() => vi.clearAllMocks())

function renderModal(onClose = vi.fn()) {
  render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <ActionComposeModal open title="Reply to: Budget question" onClose={onClose} />
    </ThemeProvider>,
  )
  return onClose
}

describe('ActionComposeModal', () => {
  it('submit fires a toast, closes, makes no network call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const onClose = renderModal()
    fireEvent.change(screen.getByLabelText(/what should happen/i), { target: { value: 'draft a polite decline' } })
    fireEvent.click(screen.getByRole('button', { name: /queue/i }))
    expect(toast.success).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
