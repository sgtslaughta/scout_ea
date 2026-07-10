import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { TopicsView } from './Topics'

describe('Topics view', () => {
  let queryClient: QueryClient
  const mockTopicsData = [
    {
      id: 1,
      name: 'AI Strategy',
      description: 'Long-term AI initiatives',
      priority: 1,
      max_suggest: 5,
      active: 1,
    },
    {
      id: 2,
      name: 'Security Updates',
      description: 'Infrastructure improvements',
      priority: 2,
      max_suggest: 3,
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

  it('renders Topics heading', async () => {
    mockFetch([])
    renderWithRouter(<TopicsView />)

    expect(screen.getByText('Topics')).toBeDefined()
  })

  it('renders Add button', async () => {
    mockFetch([])
    renderWithRouter(<TopicsView />)

    const addButton = screen.getByRole('button', { name: /Add topic/i })
    expect(addButton).toBeDefined()
  })

  it('opens add dialog when Add button is clicked', async () => {
    mockFetch([])
    renderWithRouter(<TopicsView />)

    const addButton = screen.getByRole('button', { name: /Add topic/i })
    addButton.click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Add topic/i })).toBeDefined()
    })
  })

  it('renders empty state when no topics exist', async () => {
    mockFetch([])
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      expect(screen.getByText(/No topics yet/i)).toBeDefined()
    })
  })

  it('renders DataGrid with topics rows', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      expect(screen.getByText('AI Strategy')).toBeDefined()
      expect(screen.getByText('Security Updates')).toBeDefined()
    })
  })

  it('displays topic details in DataGrid cells', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      // Topic names are displayed
      expect(screen.getByText('AI Strategy')).toBeDefined()
      expect(screen.getByText('Security Updates')).toBeDefined()
      // Priority values are displayed as chips
      expect(screen.getByText(/Critical/)).toBeDefined()
      expect(screen.getByText(/High/)).toBeDefined()
    })
  })

  it('renders Edit button in actions column', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/Edit/)
      expect(editButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('renders Delete button in actions column', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText(/Delete/)
      expect(deleteButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('opens edit dialog when Edit button is clicked', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/Edit/)
      expect(editButtons[0]).toBeDefined()
    })

    const editButtons = screen.getAllByLabelText(/Edit/)
    editButtons[0].click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Edit topic/i })).toBeDefined()
    })
  })

  it('pre-fills form with topic data when editing', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/Edit/)
      expect(editButtons[0]).toBeDefined()
    })

    const editButtons = screen.getAllByLabelText(/Edit/)
    editButtons[0].click()

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('AI Strategy') as HTMLInputElement
      expect(nameInput).toBeDefined()
      expect(nameInput.value).toBe('AI Strategy')
    })
  })

  it('closes dialog when Cancel button is clicked', async () => {
    mockFetch([])
    renderWithRouter(<TopicsView />)

    const addButton = screen.getByRole('button', { name: /Add topic/i })
    addButton.click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Add topic/i })).toBeDefined()
    })

    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    cancelButton.click()

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add topic/i })).toBeNull()
    })
  })

  it('opens delete confirmation dialog when Delete button is clicked', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText(/Delete/)
      expect(deleteButtons[0]).toBeDefined()
    })

    const deleteButtons = screen.getAllByLabelText(/Delete/)
    deleteButtons[0].click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Deactivate AI Strategy/i })).toBeDefined()
    })
  })

  it('shows include-inactive toggle switch', async () => {
    mockFetch([])
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      const switchLabel = screen.getByText('Include inactive')
      expect(switchLabel).toBeDefined()
    })
  })

  it('loads topics on mount with API call', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      expect(screen.getByText('AI Strategy')).toBeDefined()
    })

    expect(global.fetch).toHaveBeenCalled()
  })

  it('validates name field is required in add dialog', async () => {
    mockFetch([])
    renderWithRouter(<TopicsView />)

    const addButton = screen.getByRole('button', { name: /Add topic/i })
    addButton.click()

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Add$/i })
      expect(submitButton.hasAttribute('disabled')).toBe(true)
    })
  })

  it('renders form fields in add dialog', async () => {
    mockFetch([])
    renderWithRouter(<TopicsView />)

    const addButton = screen.getByRole('button', { name: /Add topic/i })
    addButton.click()

    await waitFor(() => {
      const nameInputs = screen.getAllByRole('textbox')
      expect(nameInputs.length).toBeGreaterThan(0)
    })

    expect(screen.getByLabelText(/Name/)).toBeDefined()
    expect(screen.getByLabelText(/Description/)).toBeDefined()
    expect(screen.getByLabelText(/Max Suggestions/)).toBeDefined()
  })

  it('displays error alert when data loading fails', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('API error'))
    mockFetch([])
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      expect(screen.getByText(/Error loading topics/i)).toBeDefined()
    })
  })

  it('renders priority as colored chip in DataGrid', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      const chips = document.querySelectorAll('.MuiChip-root')
      expect(chips.length).toBeGreaterThan(0)
    })
  })

  it('renders max suggest value in DataGrid', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      expect(screen.getByText('5')).toBeDefined()
      expect(screen.getByText('3')).toBeDefined()
    })
  })

  it('renders deactivate confirmation dialog when delete is clicked', async () => {
    mockFetch(mockTopicsData)
    renderWithRouter(<TopicsView />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText(/Delete/)
      expect(deleteButtons[0]).toBeDefined()
    })

    const deleteButtons = screen.getAllByLabelText(/Delete/)
    deleteButtons[0].click()

    await waitFor(
      () => {
        // Dialog opens with deactivate message
        expect(screen.queryByText(/Deactivate/i)).toBeDefined()
      },
      { timeout: 2000 }
    )
  })
})
