import { useEffect, useState } from 'react'
import { getConfig } from '@/api'

export interface WeatherLocation {
  lat: number; lon: number; label: string; source: 'geo' | 'config'
}

/** Pure choice: geolocation position (or null) + config dict -> location. */
export function chooseLocation(
  geo: GeolocationPosition | null,
  cfg: Record<string, string>,
): WeatherLocation {
  const label = cfg.weather_label || 'Weather'
  if (geo) {
    return { lat: geo.coords.latitude, lon: geo.coords.longitude, label, source: 'geo' }
  }
  return {
    lat: Number(cfg.weather_lat ?? 0),
    lon: Number(cfg.weather_lon ?? 0),
    label, source: 'config',
  }
}

/** Resolve location: browser geolocation (short timeout) -> config fallback. */
export function useWeatherLocation(enabled: boolean): WeatherLocation | null {
  const [loc, setLoc] = useState<WeatherLocation | null>(null)
  useEffect(() => {
    if (!enabled) return
    let done = false
    const finish = (geo: GeolocationPosition | null, cfg: Record<string, string>) => {
      if (!done) { done = true; setLoc(chooseLocation(geo, cfg)) }
    }
    getConfig().then((cfg) => {
      if (!navigator.geolocation) return finish(null, cfg)
      navigator.geolocation.getCurrentPosition(
        (pos) => finish(pos, cfg),
        () => finish(null, cfg),
        { timeout: 4000, enableHighAccuracy: false },
      )
    }).catch(() => finish(null, {}))
    return () => { done = true }
  }, [enabled])
  return loc
}
