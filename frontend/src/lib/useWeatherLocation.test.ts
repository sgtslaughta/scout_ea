import { describe, it, expect } from 'vitest'
import { chooseLocation } from './useWeatherLocation'

const cfg = { weather_lat: '40.71', weather_lon: '-74.01', weather_label: 'NYC' }

describe('chooseLocation', () => {
  it('prefers geolocation when present', () => {
    const geo = { coords: { latitude: 51.5, longitude: -0.12 } } as GeolocationPosition
    expect(chooseLocation(geo, cfg)).toEqual(
      { lat: 51.5, lon: -0.12, label: 'NYC', source: 'geo' })
  })
  it('falls back to config when geo is null', () => {
    expect(chooseLocation(null, cfg)).toEqual(
      { lat: 40.71, lon: -74.01, label: 'NYC', source: 'config' })
  })
  it('defaults label when config label missing', () => {
    const out = chooseLocation(null, { weather_lat: '1', weather_lon: '2' })
    expect(out).toEqual({ lat: 1, lon: 2, label: 'Weather', source: 'config' })
  })
})
