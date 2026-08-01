import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { chooseLocation, useWeatherLocation, hasConfiguredCity } from './useWeatherLocation'
import * as api from '@/api'

const cfg = { weather_lat: '40.71', weather_lon: '-74.01', weather_label: 'NYC' }

describe('chooseLocation', () => {
  it('keeps the chosen city even when geolocation is available', () => {
    // Previously geolocation won here, which meant the city picked in
    // Settings was silently ignored.
    const geo = { coords: { latitude: 51.5, longitude: -0.12 } } as GeolocationPosition
    expect(chooseLocation(geo, cfg)).toEqual(
      { lat: 40.71, lon: -74.01, label: 'NYC', source: 'config' })
  })

  it('uses geolocation when no city has been chosen', () => {
    const geo = { coords: { latitude: 51.5, longitude: -0.12 } } as GeolocationPosition
    expect(chooseLocation(geo, {})).toEqual(
      { lat: 51.5, lon: -0.12, label: 'Nearby', source: 'geo' })
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

  it('never asks for geolocation once a city is configured', async () => {
    const getCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    })

    const { result } = renderHook(() => useWeatherLocation(true))

    await waitFor(() => expect(result.current?.source).toBe('config'))
    // Asking would imply the answer might override the user's choice.
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(result.current?.label).toBe('NYC')
  })
})

describe('a chosen city beats browser geolocation', () => {
  const cfg = { weather_label: 'Columbia', weather_lat: '39.24', weather_lon: '-76.84' }
  const geo = { coords: { latitude: 1, longitude: 2 } } as GeolocationPosition

  it('uses the configured city even when geolocation is available', () => {
    // Regression: geolocation used to win, so picking a city in Settings
    // appeared to do nothing at all.
    const loc = chooseLocation(geo, cfg)
    expect(loc.label).toBe('Columbia')
    expect(loc.lat).toBeCloseTo(39.24)
    expect(loc.source).toBe('config')
  })

  it('falls back to geolocation only when no city has been chosen', () => {
    expect(chooseLocation(geo, {}).source).toBe('geo')
  })

  it('treats a partially-set city as unset', () => {
    expect(hasConfiguredCity({ weather_label: 'Columbia' })).toBe(false)
    expect(hasConfiguredCity(cfg)).toBe(true)
  })
})
