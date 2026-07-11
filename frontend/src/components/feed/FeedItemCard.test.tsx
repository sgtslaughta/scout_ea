import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/theme'
import { FeedItemCard } from './FeedItemCard'

const item = { category: 'news', id: 7, title: 'Agent framework 1.0', when: '2026-07-10T13:00:00',
  url: 'http://x', status: 'new', tags: [{ tag_id: 1, name: 'external', color: 'blue' }], links: [] }

function renderCard(onSelect = vi.fn()) {
  render(<ThemeProvider theme={theme} defaultMode="dark"><FeedItemCard item={item} onSelect={onSelect} /></ThemeProvider>)
  return onSelect
}

describe('FeedItemCard', () => {
  it('shows title + tag chip', () => {
    renderCard()
    expect(screen.getByText('Agent framework 1.0')).toBeInTheDocument()
    expect(screen.getByText('external')).toBeInTheDocument()
  })
  it('fires onSelect with the item on click', () => {
    const onSelect = renderCard()
    fireEvent.click(screen.getByText('Agent framework 1.0'))
    expect(onSelect).toHaveBeenCalledWith(item)
  })
})
