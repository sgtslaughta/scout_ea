import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { toast } from 'sonner'
import { theme } from '../theme'
import * as api from '@/api'
import { RowTaskButton } from './RowTaskButton'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, createTask: vi.fn(async () => ({ id: 1 })) }
})

const mockCreateTask = vi.mocked(api.createTask)

afterEach(() => vi.clearAllMocks())

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('RowTaskButton', () => {
  it('is hidden-but-focusable and opens the modal on click', async () => {
    wrap(<RowTaskButton draft={{ title: 'Follow up: Contoso', source: 'OU Feedback — Dana R., Jul 30' }} />)

    const button = screen.getByRole('button', { name: /create a task from this/i })
    button.focus()
    expect(button).toHaveFocus()

    fireEvent.click(button)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('renders the checked glyph and different wording when already added, and stays clickable', async () => {
    wrap(<RowTaskButton draft={{ title: 'Follow up: Contoso' }} alreadyAdded />)

    const button = screen.getByRole('button', { name: /task already created — add another\?/i })
    expect(button).toBeEnabled()

    fireEvent.click(button)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('creates a task via the modal with the drafted title', async () => {
    wrap(<RowTaskButton draft={{ title: 'Follow up: Contoso', detail: 'call back', source: 'OU Feedback — Dana R., Jul 30' }} />)

    fireEvent.click(screen.getByRole('button', { name: /create a task from this/i }))
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Follow up: Contoso' }),
    ))
    expect(toast.success).toHaveBeenCalled()
  })
})
