import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeatherBand } from './WeatherBand'

const NOW = new Date('2026-06-21T13:00:00Z')
const base = { temp: 18, condition: 'rain' as const, is_day: true,
  sunrise: '2026-06-21T06:00:00Z', sunset: '2026-06-21T20:00:00Z', label: 'NYC', stale: false }

describe('WeatherBand', () => {
  it('renders temp, label, and a condition FX layer', () => {
    render(<WeatherBand weather={base} now={NOW} />)
    expect(screen.getByText(/NYC/)).toBeInTheDocument()
    expect(screen.getByText(/18/)).toBeInTheDocument()
    expect(screen.getByTestId('condition-rain')).toBeInTheDocument()
  })
  it('shows unavailable state on error payload', () => {
    render(<WeatherBand weather={{ error: 'unavailable', label: 'NYC' }} now={NOW} />)
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument()
  })
  it('renders sun in day and marks celestial body', () => {
    render(<WeatherBand weather={base} now={NOW} />)
    expect(screen.getByTestId('celestial-sun')).toBeInTheDocument()
  })
  it('shows the unit symbol and a forecast strip (skipping today)', () => {
    render(<WeatherBand weather={{ ...base, unit: 'F', forecast: [
      { date: '2026-06-21', hi: 80, lo: 60, condition: 'clear' },   // today, skipped
      { date: '2026-06-22', hi: 82, lo: 61, condition: 'rain' },
    ] }} now={NOW} />)
    expect(screen.getByText(/18°F/)).toBeInTheDocument()
    const fc = screen.getByTestId('weather-forecast')
    expect(fc).toHaveTextContent('82°')   // tomorrow shown
    expect(fc).not.toHaveTextContent('80°')  // today omitted
  })
  it('stretches the celestial arc across the full band width', () => {
    const { container } = render(
      <WeatherBand
        weather={{
          temp: 20, condition: 'clear', is_day: true, unit: 'C', label: 'Test',
          sunrise: '2026-07-25T06:00:00Z', sunset: '2026-07-25T20:00:00Z',
        }}
        now={new Date('2026-07-25T13:00:00Z')}
      />,
    )
    const svg = container.querySelector('svg')
    // Without this, xMidYMid meet letterboxes the arc into a narrow centered strip.
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('none')
  })
})
