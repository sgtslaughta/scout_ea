import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { toast } from 'sonner'
import { theme } from '../theme'
import * as api from '@/api'
import { TaskDraftModal } from './TaskDraftModal'
import type { TaskDraft } from './TaskDraftModal'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, createTask: vi.fn(async () => ({ id: 1 })) }
})

const mockCreateTask = vi.mocked(api.createTask)

afterEach(() => vi.clearAllMocks())

function wrap(draft: TaskDraft | null, onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <TaskDraftModal open draft={draft} onClose={onClose} />
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return { onClose, invalidateSpy }
}

const draft: TaskDraft = {
  title: 'Follow up: Contoso',
  detail: 'renewal stuck in legal',
  source: 'OU Feedback — Dana R., Jul 30',
}

describe('TaskDraftModal', () => {
  it('prefills the title and the From: source line in detail', () => {
    wrap(draft)
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Follow up: Contoso')
    const detailField = screen.getByRole('textbox', { name: 'Detail' }) as HTMLTextAreaElement
    expect(detailField.value).toContain('From: OU Feedback — Dana R., Jul 30')
    expect(detailField.value).toContain('renewal stuck in legal')
  })

  it('disables Save when the title is empty', () => {
    wrap({ title: '' })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'x' } })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled()
  })

  it('edits the title and saves with the expected title/detail/priority/due_at', async () => {
    const { onClose, invalidateSpy } = wrap(draft)

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Edited title' } })
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-08-15' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Edited title',
      detail: expect.stringContaining('renewal stuck in legal'),
      priority: 3,
      due_at: '2026-08-15',
    })))
    expect(toast.success).toHaveBeenCalled()
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['tasks'] })))
    expect(onClose).toHaveBeenCalled()
  })

  it('writes 2/3/4 for High/Normal/Low priority', async () => {
    wrap(draft)
    fireEvent.mouseDown(screen.getByLabelText('Priority'))
    fireEvent.click(await screen.findByRole('option', { name: 'High' }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ priority: 2 })))
  })
})
