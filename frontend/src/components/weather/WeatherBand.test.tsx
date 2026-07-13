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
})
