import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/theme'
import { KeyPeopleCarousel } from './KeyPeopleCarousel'

const items = [
  { category: 'news', id: 1, title: 'Ada shipped it', when: '2026-07-10T00:00:00', status: 'new',
    tags: [], links: [{ id: 9, target_type: 'person', target_id: 3, label: 'Ada' }] },
  { category: 'news', id: 2, title: 'no person here', when: '2026-07-09T00:00:00', status: 'new', tags: [], links: [] },
]

describe('KeyPeopleCarousel', () => {
  it('shows a card per person with their latest item; click fires onSelect', () => {
    const onSelect = vi.fn()
    render(<ThemeProvider theme={theme} defaultMode="dark"><KeyPeopleCarousel items={items} onSelect={onSelect} /></ThemeProvider>)
    expect(screen.getByText('Ada')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Ada shipped it'))
    expect(onSelect).toHaveBeenCalledWith(items[0])
  })
  it('renders empty-state when no person-linked items', () => {
    render(<ThemeProvider theme={theme} defaultMode="dark"><KeyPeopleCarousel items={[items[1]]} onSelect={() => {}} /></ThemeProvider>)
    expect(screen.getByText(/No key-people activity/i)).toBeInTheDocument()
  })
})
