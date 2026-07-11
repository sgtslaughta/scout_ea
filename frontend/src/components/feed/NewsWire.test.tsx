import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/theme'
import { NewsWire } from './NewsWire'

const items = [
  { category: 'news', id: 1, title: 'Headline A', when: '2026-07-10T00:00:00', status: 'new', tags: [], links: [] },
  { category: 'trending', id: 2, title: 'Headline B', when: '2026-07-09T00:00:00', status: '', tags: [], links: [] },
]

describe('NewsWire', () => {
  it('renders headlines and fires onSelect', () => {
    const onSelect = vi.fn()
    render(<ThemeProvider theme={theme} defaultMode="dark"><NewsWire items={items} onSelect={onSelect} /></ThemeProvider>)
    const els = screen.getAllByText((content, el) => content.includes('Headline A') && el?.tagName === 'SPAN')
    fireEvent.click(els[0])
    expect(onSelect).toHaveBeenCalledWith(items[0])
  })
  it('renders nothing when empty', () => {
    const { container } = render(<ThemeProvider theme={theme} defaultMode="dark"><NewsWire items={[]} onSelect={() => {}} /></ThemeProvider>)
    expect(container.textContent).toContain('No headlines')
  })
})
