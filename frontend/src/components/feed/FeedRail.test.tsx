import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/theme'
import { FeedRail } from './FeedRail'

describe('FeedRail', () => {
  it('lists the five views and reports clicks', () => {
    const onView = vi.fn()
    render(<ThemeProvider theme={theme} defaultMode="dark"><FeedRail view="overview" onView={onView} /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /news/i }))
    expect(onView).toHaveBeenCalledWith('news')
  })
})
