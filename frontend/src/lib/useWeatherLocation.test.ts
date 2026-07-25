import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { chooseLocation, useWeatherLocation } from './useWeatherLocation'
import * as api from '@/api'

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

describe('useWeatherLocation', () => {
  const originalGeo = navigator.geolocation

  beforeEach(() => {
    vi.spyOn(api, 'getConfig').mockResolvedValue(cfg)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'geolocation', { value: originalGeo, configurable: true })
  })

  it('resolves to the config location without waiting on a geolocation callback that never fires', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: vi.fn() }, // never invokes success or error callback
      configurable: true,
    })

    const { result } = renderHook(() => useWeatherLocation(true))

    await waitFor(() => {
      expect(result.current).toEqual({ lat: 40.71, lon: -74.01, label: 'NYC', source: 'config' })
    })
  })

  it('upgrades to the geolocation-derived location once the success callback fires', async () => {
    const pos = { coords: { latitude: 51.5, longitude: -0.12 } } as GeolocationPosition
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          success(pos)
        }),
      },
      configurable: true,
    })

    const { result } = renderHook(() => useWeatherLocation(true))

    await waitFor(() => {
      expect(result.current?.source).toBe('geo')
    })
    expect(result.current).toEqual({ lat: 51.5, lon: -0.12, label: 'NYC', source: 'geo' })
  })
})
