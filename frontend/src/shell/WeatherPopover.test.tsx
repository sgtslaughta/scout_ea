import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WeatherResponse } from '@/api'
import { WeatherPopover } from './WeatherPopover'

const weather: WeatherResponse = {
  temp: 87, unit: 'F', condition: 'clouds',
  forecast: [
    { date: '2026-08-01', hi: 87, lo: 70, condition: 'clouds' },
    { date: '2026-08-02', hi: 85, lo: 68, condition: 'clear' },
    { date: '2026-08-03', hi: 90, lo: 72, condition: 'storm' },
    { date: '2026-08-04', hi: 80, lo: 65, condition: 'rain' },
    { date: '2026-08-05', hi: 78, lo: 60, condition: 'snow' },
  ],
}

function anchor() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('WeatherPopover', () => {
  it('shows the location label, today\'s hi/lo, and a 5-day forecast', () => {
    render(<WeatherPopover weather={weather} label="New York" anchorEl={anchor()} open onClose={() => {}} />)
    expect(screen.getByText('New York')).toBeInTheDocument()
    // today's hi/lo (first forecast entry)
    expect(screen.getAllByText(/87°F/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/70°F/).length).toBeGreaterThan(0)
    // one glyph per forecast day, each with an accessible label
    const glyphs = screen.getAllByRole('img')
    expect(glyphs).toHaveLength(5)
    expect(glyphs[1]).toHaveAccessibleName('clear')
  })
})
