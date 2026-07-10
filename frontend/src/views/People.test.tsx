import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { PeopleView } from './People'

describe('People view', () => {
  let queryClient: QueryClient
  const mockPeopleData = [
    {
      id: 1,
      name: 'Alice Johnson',
      role: 'Product Manager',
      org: 'Tech Corp',
      importance: 1,
      notes: 'Key stakeholder',
      active: 1,
    },
    {
      id: 2,
      name: 'Bob Smith',
      role: 'Engineer',
      org: 'Tech Corp',
      importance: 3,
      notes: '',
      active: 1,
    },
  ]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  const mockFetch = (data: any[] = []) => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    })
  }

  const renderWithRouter = (component: React.ReactNode) => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          {component}
        </QueryClientProvider>
      </BrowserRouter>
    )
  }

  it('renders People heading', async () => {
    mockFetch([])
    renderWithRouter(<PeopleView />)

    expect(screen.getByText('People')).toBeDefined()
  })

  it('renders Add button', async () => {
    mockFetch([])
    renderWithRouter(<PeopleView />)

    const addButton = screen.getByRole('button', { name: /Add person/i })
    expect(addButton).toBeDefined()
  })

  it('opens add dialog when Add button is clicked', async () => {
    mockFetch([])
    renderWithRouter(<PeopleView />)

    const addButton = screen.getByRole('button', { name: /Add person/i })
    addButton.click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Add person/i })).toBeDefined()
    })
  })

  it('renders empty state when no people exist', async () => {
    mockFetch([])
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      expect(screen.getByText(/No active people/i)).toBeDefined()
    })
  })

  it('renders DataGrid with people rows', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeDefined()
      expect(screen.getByText('Bob Smith')).toBeDefined()
    })
  })

  it('displays person details in DataGrid cells', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      expect(screen.getByText('Product Manager')).toBeDefined()
      expect(screen.getByText('Engineer')).toBeDefined()
    })
  })

  it('renders Edit button in actions column', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/Edit/)
      expect(editButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('renders Deactivate button in actions column', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      const deactivateButtons = screen.getAllByLabelText(/Deactivate/)
      expect(deactivateButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('opens edit dialog when Edit button is clicked', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/Edit/)
      expect(editButtons[0]).toBeDefined()
    })

    const editButtons = screen.getAllByLabelText(/Edit/)
    editButtons[0].click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Edit person/i })).toBeDefined()
    })
  })

  it('pre-fills form with person data when editing', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/Edit/)
      expect(editButtons[0]).toBeDefined()
    })

    const editButtons = screen.getAllByLabelText(/Edit/)
    editButtons[0].click()

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Alice Johnson') as HTMLInputElement
      expect(nameInput).toBeDefined()
      expect(nameInput.value).toBe('Alice Johnson')
    })
  })

  it('closes dialog when Cancel button is clicked', async () => {
    mockFetch([])
    renderWithRouter(<PeopleView />)

    const addButton = screen.getByRole('button', { name: /Add person/i })
    addButton.click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Add person/i })).toBeDefined()
    })

    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    cancelButton.click()

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add person/i })).toBeNull()
    })
  })

  it('opens delete confirmation dialog when Deactivate button is clicked', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      const deactivateButtons = screen.getAllByLabelText(/Deactivate/)
      expect(deactivateButtons[0]).toBeDefined()
    })

    const deactivateButtons = screen.getAllByLabelText(/Deactivate/)
    deactivateButtons[0].click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Deactivate Alice Johnson/i })).toBeDefined()
    })
  })

  it('shows include-inactive toggle switch', async () => {
    mockFetch([])
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      const switchLabel = screen.getByText('Include inactive')
      expect(switchLabel).toBeDefined()
    })
  })

  it('loads people on mount with API call', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeDefined()
    })

    expect(global.fetch).toHaveBeenCalled()
  })

  it('validates name field is required in add dialog', async () => {
    mockFetch([])
    renderWithRouter(<PeopleView />)

    const addButton = screen.getByRole('button', { name: /Add person/i })
    addButton.click()

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Add$/i })
      expect(submitButton.hasAttribute('disabled')).toBe(true)
    })
  })

  it('renders form fields in add dialog', async () => {
    mockFetch([])
    renderWithRouter(<PeopleView />)

    const addButton = screen.getByRole('button', { name: /Add person/i })
    addButton.click()

    await waitFor(() => {
      const nameInputs = screen.getAllByRole('textbox')
      expect(nameInputs.length).toBeGreaterThan(0)
    })

    expect(screen.getByLabelText(/Name/)).toBeDefined()
    expect(screen.getByLabelText(/Role/)).toBeDefined()
    expect(screen.getByLabelText(/Organization/)).toBeDefined()
    expect(screen.getByLabelText(/Notes/)).toBeDefined()
  })

  it('displays error alert when data loading fails', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('API error'))
    mockFetch([])
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      expect(screen.getByText(/Error loading people/i)).toBeDefined()
    })
  })

  it('renders importance as colored chip in DataGrid', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      const chips = document.querySelectorAll('.MuiChip-root')
      expect(chips.length).toBeGreaterThan(0)
    })
  })

  it('renders status chip for person row', async () => {
    mockFetch(mockPeopleData)
    renderWithRouter(<PeopleView />)

    await waitFor(() => {
      // DataGrid renders status in chip, look for the chip content
      const statusChips = screen.getAllByText(/Active/)
      expect(statusChips.length).toBeGreaterThan(0)
    })
  })
})
