import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { toast } from 'sonner'
import { theme } from '../theme'
import * as api from '@/api'
import { PersonName } from './PersonName'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof api>('@/api')
  return { ...actual, getPeople: vi.fn(), addPerson: vi.fn(async () => ({ id: 1 })) }
})

const mockGetPeople = vi.mocked(api.getPeople)
const mockAddPerson = vi.mocked(api.addPerson)

afterEach(() => vi.clearAllMocks())

const existing: api.Person[] = [
  { id: 1, name: 'Alex Exec', role: 'AE', org: 'Contoso', importance: 2, active: 1, handles: [] },
  {
    id: 2, name: 'Renamed Person', role: undefined, org: undefined, importance: 1, active: 1,
    handles: [{ channel: 'email', handle: 'jamie@fabrikam.com' }],
  },
]

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('PersonName', () => {
  it('offers a track action for an untracked name and calls addPerson with the right shape', async () => {
    mockGetPeople.mockResolvedValueOnce([])
    wrap(<PersonName name="New Person" email="new@contoso.com" />)

    const button = await screen.findByRole('button', { name: /track new person/i })
    fireEvent.click(button)

    await waitFor(() => expect(mockAddPerson).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Person', email: 'new@contoso.com', importance: expect.any(Number) }),
    ))
    expect(toast.success).toHaveBeenCalled()
  })

  it('treats an { existing: true } response as already-tracked, not a new person', async () => {
    mockGetPeople.mockResolvedValueOnce([])
    mockAddPerson.mockResolvedValueOnce({ id: 7, existing: true })
    wrap(<PersonName name="Known By Address" email="known@contoso.com" />)

    const button = await screen.findByRole('button', { name: /track known by address/i })
    fireEvent.click(button)

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/already/i)))
  })

  it('does not offer the action for a name already tracked', async () => {
    mockGetPeople.mockResolvedValueOnce(existing)
    wrap(<PersonName name="Alex Exec" />)

    await waitFor(() => expect(mockGetPeople).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('button', { name: /track alex exec/i })).not.toBeInTheDocument())
  })

  it('matches names case-insensitively', async () => {
    mockGetPeople.mockResolvedValueOnce(existing)
    wrap(<PersonName name="alex exec" />)

    await waitFor(() => expect(mockGetPeople).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('button', { name: /track/i })).not.toBeInTheDocument())
  })

  it('matches by email even when the display name differs', async () => {
    mockGetPeople.mockResolvedValueOnce(existing)
    wrap(<PersonName name="Jamie Totally Different" email="jamie@fabrikam.com" />)

    await waitFor(() => expect(mockGetPeople).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('button', { name: /track/i })).not.toBeInTheDocument())
  })

  it('is keyboard reachable', async () => {
    mockGetPeople.mockResolvedValueOnce([])
    wrap(<PersonName name="Keyboard Person" />)

    const button = await screen.findByRole('button', { name: /track keyboard person/i })
    button.focus()
    expect(button).toHaveFocus()
  })

  it('invalidates the people query after adding', async () => {
    mockGetPeople.mockResolvedValueOnce([])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    render(
      <QueryClientProvider client={qc}>
        <ThemeProvider theme={theme}><PersonName name="Invalidate Person" /></ThemeProvider>
      </QueryClientProvider>,
    )

    const button = await screen.findByRole('button', { name: /track invalidate person/i })
    fireEvent.click(button)

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['people'] }),
    ))
  })
})
