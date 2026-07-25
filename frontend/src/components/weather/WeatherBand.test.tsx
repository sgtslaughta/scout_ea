import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeatherBand } from './WeatherBand'

const base = { temp: 18, condition: 'rain' as const, is_day: true,
  sunrise: '2026-06-21T06:00:00Z', sunset: '2026-06-21T20:00:00Z', label: 'NYC', stale: false }

describe('WeatherBand', () => {
  it('renders temp and label', () => {
    render(<WeatherBand weather={base} />)
    expect(screen.getByText(/NYC/)).toBeInTheDocument()
    expect(screen.getByText(/18/)).toBeInTheDocument()
  })
  it('does not render its own condition FX layer — the modal-level layer shows through instead', () => {
    render(<WeatherBand weather={base} />)
    expect(screen.queryByTestId('condition-rain')).not.toBeInTheDocument()
  })
  it('shows unavailable state on error payload', () => {
    render(<WeatherBand weather={{ error: 'unavailable', label: 'NYC' }} />)
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument()
  })
  it('shows the unit symbol and a forecast strip (skipping today)', () => {
    render(<WeatherBand weather={{ ...base, unit: 'F', forecast: [
      { date: '2026-06-21', hi: 80, lo: 60, condition: 'clear' },   // today, skipped
      { date: '2026-06-22', hi: 82, lo: 61, condition: 'rain' },
    ] }} />)
    expect(screen.getByText(/18°F/)).toBeInTheDocument()
    const fc = screen.getByTestId('weather-forecast')
    expect(fc).toHaveTextContent('82°')   // tomorrow shown
    expect(fc).not.toHaveTextContent('80°')  // today omitted
  })
  it('does not render its own sky backdrop — the modal-level backdrop shows through instead', () => {
    render(<WeatherBand weather={base} />)
    expect(screen.queryByTestId('sky-backdrop')).not.toBeInTheDocument()
  })
  it('renders a scrim behind the location and temperature', () => {
    render(
      <WeatherBand
        weather={{
          temp: 30, condition: 'clear', is_day: true, unit: 'F', label: 'Austin',
          sunrise: '2026-07-25T06:00:00Z', sunset: '2026-07-25T20:00:00Z',
        }}
      />,
    )
    expect(screen.getByTestId('weather-scrim')).toBeInTheDocument()
  })
  it('renders a distinct glyph per forecast day, matching its condition', () => {
    render(<WeatherBand weather={{ ...base, forecast: [
      { date: '2026-06-21', hi: 80, lo: 60, condition: 'clear' },   // today, skipped
      { date: '2026-06-22', hi: 82, lo: 61, condition: 'rain' },
      { date: '2026-06-23', hi: 70, lo: 55, condition: 'snow' },
      { date: '2026-06-24', hi: 65, lo: 50, condition: 'clouds' },
    ] }} />)
    expect(screen.getByTestId('forecast-glyph-2026-06-22')).toHaveAccessibleName(/rain/i)
    expect(screen.getByTestId('forecast-glyph-2026-06-23')).toHaveAccessibleName(/snow/i)
    expect(screen.getByTestId('forecast-glyph-2026-06-24')).toHaveAccessibleName(/clouds/i)
  })
  it('renders a glyph for the current condition next to the temperature', () => {
    render(<WeatherBand weather={base} />)
    expect(screen.getByTestId('current-weather-glyph')).toHaveAccessibleName(/rain/i)
  })
  it('exposes the current condition glyph with role="img" so its label is announced', () => {
    render(<WeatherBand weather={base} />)
    expect(screen.getByRole('img', { name: 'rain' })).toBe(screen.getByTestId('current-weather-glyph'))
  })
  it('renders a local scrim protecting the forecast strip', () => {
    render(
      <WeatherBand
        weather={{
          temp: 30, condition: 'clear', is_day: true, unit: 'F', label: 'Austin',
          sunrise: '2026-07-25T06:00:00Z', sunset: '2026-07-25T20:00:00Z',
          forecast: [
            { date: '2026-07-25', hi: 95, lo: 75, condition: 'clear' },
            { date: '2026-07-26', hi: 96, lo: 76, condition: 'clear' },
          ],
        }}
      />,
    )
    expect(screen.getByTestId('weather-forecast-scrim')).toBeInTheDocument()
  })
})
