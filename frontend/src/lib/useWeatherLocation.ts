import { useEffect, useState } from 'react'
import { getConfig } from '@/api'

export interface WeatherLocation {
  lat: number; lon: number; label: string; source: 'geo' | 'config'
}

/** Seed default (backend/ea/seed.sql) used when config itself fails to load. */
const FALLBACK_CONFIG = { weather_lat: '40.71', weather_lon: '-74.01', weather_label: 'New York' }

/** True when the user has actually chosen a city in Settings. */
export function hasConfiguredCity(cfg: Record<string, string>): boolean {
  return Boolean(cfg.weather_label && cfg.weather_lat && cfg.weather_lon)
}

/**
 * Pure choice: geolocation position (or null) + config dict -> location.
 *
 * A city picked in Settings WINS over browser geolocation. Geolocation is
 * only a convenience for users who never chose one — previously it silently
 * overrode the explicit setting, so picking a city appeared to do nothing.
 */
export function chooseLocation(
  geo: GeolocationPosition | null,
  cfg: Record<string, string>,
): WeatherLocation {
  const label = cfg.weather_label || 'Weather'
  if (hasConfiguredCity(cfg)) {
    return {
      lat: Number(cfg.weather_lat),
      lon: Number(cfg.weather_lon),
      label, source: 'config',
    }
  }
  if (geo) {
    // No city chosen, so there's no label to show — say where it came from.
    return {
      lat: geo.coords.latitude,
      lon: geo.coords.longitude,
      label: cfg.weather_label || 'Nearby',
      source: 'geo',
    }
  }
  return {
    lat: Number(cfg.weather_lat ?? 0),
    lon: Number(cfg.weather_lon ?? 0),
    label, source: 'config',
  }
}

/**
 * Resolve location: show the config location immediately, then silently
 * upgrade to precise geolocation if/when the browser permission prompt
 * resolves. Never blocks on geolocation — a dismissed or ignored permission
 * prompt must not leave the modal without weather.
 */
export function useWeatherLocation(enabled: boolean): WeatherLocation | null {
  const [loc, setLoc] = useState<WeatherLocation | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getConfig().then((cfg) => {
      if (cancelled) return
      setLoc(chooseLocation(null, cfg))
      // Don't even ask for geolocation once a city is set — asking implies it
      // might override the choice, and it must not.
      if (hasConfiguredCity(cfg)) return
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => { if (!cancelled) setLoc(chooseLocation(pos, cfg)) },
        () => {},
        { timeout: 4000, enableHighAccuracy: false },
      )
    }).catch(() => {
      if (!cancelled) setLoc(chooseLocation(null, FALLBACK_CONFIG))
    })
    return () => { cancelled = true }
  }, [enabled])
  return loc
}
