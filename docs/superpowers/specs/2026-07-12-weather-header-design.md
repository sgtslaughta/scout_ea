# Animated Weather Header — SP2 Design

**Date:** 2026-07-12
**Status:** Approved
**Program:** Skills-based Daily Briefing (SP2 of 3)

## Summary

Fill the daily-briefing super-modal's top weather-band placeholder with a live,
animated weather header: a time-of-day sky, a sun/moon riding an arc positioned
by real sunrise/sunset, and CSS/SVG condition effects (clouds, rain, snow, fog,
rays, storm). Weather comes from Open-Meteo (keyless), fetched + cached by the
backend. Location is browser geolocation with a user-defined config fallback.
Also applies the deferred "mostly full-screen, not edge-to-edge" modal tweak.

SP1 (super-modal + curation) is merged. SP3 (finance) is unaffected — it fills a
different placeholder.

## Decisions (locked)

- **Weather source:** Open-Meteo `v1/forecast`, keyless, backend-proxied + cached.
- **Location:** browser `navigator.geolocation` primary; on deny/fail/timeout,
  fall back to user-defined `weather_lat`/`weather_lon` config (seeded default).
- **Animation:** rich CSS/SVG only — sky gradient + celestial arc + condition FX.
  No new dependencies. Respects `prefers-reduced-motion`.
- **Degradation:** weather is non-blocking. Upstream failure or denied location
  must never break the modal; the band shows a graceful static/fallback state.
- **Modal sizing:** `fullScreen` → `maxWidth="xl"` + `fullWidth` + ~`92vh`
  height with inset margin (mostly full-screen, centered overlay).

## Architecture

Units, each independently testable:

1. **`backend/lib/weather.py`** — pure helpers: `classify_code(wmo_code) -> str`
   (WMO → condition category) and `normalize(raw) -> dict` (Open-Meteo JSON →
   the band's payload). No I/O.
2. **`/api/weather` endpoint** (`backend/web/app.py`) — coord validation, TTL
   cache, `urllib` fetch, calls `normalize`, graceful error envelope.
3. **`useWeatherLocation()`** (frontend hook) — geolocation → config fallback.
4. **`WeatherBand`** + children `SkyBackdrop`, `CelestialArc`, `ConditionFX`
   (frontend, presentational, driven by the weather payload + `now`).
5. **Settings field** — edits the fallback config keys.

Data flow:

```
modal opens
  → useWeatherLocation()  ──geo or config──▶ {lat, lon, label}
  → getWeather(lat, lon)  ──▶ GET /api/weather?lat=&lon=
        → cache hit? return cached
        → miss: urllib GET Open-Meteo → weather.normalize() → cache → return
  → <WeatherBand weather={...} label={...} />
        SkyBackdrop (phase from now/sunrise/sunset)
        CelestialArc (sun|moon position from sunrise/sunset/now)
        ConditionFX  (by condition category)
```

## A. Backend

### `backend/lib/weather.py`

```
CONDITIONS = {"clear", "clouds", "rain", "snow", "fog", "storm"}

def classify_code(code: int) -> str: ...   # WMO weather_code -> category
def normalize(raw: dict) -> dict: ...       # Open-Meteo payload -> band payload
```

**WMO `weather_code` → category** (`classify_code`):

- `0` → `clear`
- `1, 2, 3` → `clouds` (mainly clear/partly/overcast; band treats as clouds)
- `45, 48` → `fog`
- `51, 53, 55, 56, 57` (drizzle) → `rain`
- `61, 63, 65, 66, 67` (rain) → `rain`
- `71, 73, 75, 77` (snow) → `snow`
- `80, 81, 82` (rain showers) → `rain`
- `85, 86` (snow showers) → `snow`
- `95, 96, 99` (thunderstorm) → `storm`
- unknown → `clouds` (safe default)

**`normalize(raw)`** returns:

```
{
  "temp": <float, current.temperature_2m>,
  "code": <int, current.weather_code>,
  "condition": <classify_code(code)>,
  "is_day": <bool, current.is_day == 1>,
  "sunrise": <str ISO, daily.sunrise[0]>,
  "sunset":  <str ISO, daily.sunset[0]>,
}
```

`normalize` is defensive: missing keys → the field is `None` (never raises); a
missing `weather_code` yields `condition="clouds"`.

### `/api/weather` endpoint

`GET /api/weather?lat=<float>&lon=<float>`:

1. Parse+validate lat ∈ [-90, 90], lon ∈ [-180, 180]; 400 on bad input.
2. Round coords to 2 decimals for the cache key (`~1km` bucket).
3. Module-level cache `{ (lat2, lon2): (fetched_at, payload) }`, TTL 900s
   (15 min). Cache hit within TTL → return payload.
   `# ponytail: process-local dict cache, fine for single-process; revisit if multi-worker`
4. Miss: `urllib.request` GET
   `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto`
   with a 5s timeout. Fixed host — no SSRF surface.
5. Success → `weather.normalize(raw)`, store in cache, return
   `{ ...payload, "label": <weather_label config>, "stale": false }`.
6. Upstream/parse failure → return **HTTP 200** with
   `{ "error": "unavailable", "label": <config> }` (plus last cached payload if
   present, marked `"stale": true`). Never 5xx — the band must degrade, not break
   the modal.

### Config

Add to `WRITABLE_CONFIG`: `weather_lat`, `weather_lon`, `weather_label`. Seed
defaults in `backend/ea/seed.sql` (e.g. a sensible city — New York:
`40.71` / `-74.01` / `New York`). These are the geolocation fallback.

## B. Frontend data layer

### `getWeather` + types (`frontend/src/api.ts`)

```
export interface WeatherResponse {
  temp?: number
  code?: number
  condition?: 'clear' | 'clouds' | 'rain' | 'snow' | 'fog' | 'storm'
  is_day?: boolean
  sunrise?: string
  sunset?: string
  label?: string
  stale?: boolean
  error?: string
}
export const getWeather = (lat: number, lon: number) =>
  fetchJson<WeatherResponse>(`/api/weather?lat=${lat}&lon=${lon}`)
```

### `useWeatherLocation()` (`frontend/src/lib/useWeatherLocation.ts`)

Returns `{ lat, lon, label, source }` where `source ∈ {'geo','config'}`:

1. Read fallback config (`weather_lat/lon/label`) via the existing config API
   (this is the guaranteed baseline).
2. Call `navigator.geolocation.getCurrentPosition` with a short timeout
   (~4s) and `enableHighAccuracy: false`.
3. On success → `{lat, lon from geo, label from config, source:'geo'}`.
4. On deny / error / timeout / `navigator.geolocation` absent →
   `{...config, source:'config'}`.

Pure decision logic (given a geo result-or-error + a config object → chosen
location) is factored into a tiny testable function; the browser call wraps it.

## C. `WeatherBand` component

`frontend/src/components/weather/WeatherBand.tsx` + children. Replaces the
placeholder Box in `TodayBriefing.tsx`. Props: `{ weather: WeatherResponse;
now?: Date }` (injectable `now` for tests).

- **`SkyBackdrop`** — a CSS linear-gradient chosen by **phase**: `dawn` (near
  sunrise), `day`, `dusk` (near sunset), `night`. Phase derived from `now` vs
  `sunrise`/`sunset` (a pure `skyPhase(now, sunrise, sunset) -> phase` function).
- **`CelestialArc`** — an SVG semicircle arc. Sun shown in day, moon at night.
  Position = a pure `arcFraction(now, sunrise, sunset, is_day) -> 0..1` mapped
  onto the arc path (0 = left horizon, 1 = right horizon). Day fraction spans
  sunrise→sunset; night spans sunset→(next) sunrise.
- **`ConditionFX`** — presentational overlay keyed by `condition`:
  - `clear` → sun rays glow (day) / stars (night)
  - `clouds` → 2–3 drifting cloud shapes (slow translate keyframes)
  - `rain` → repeating rain streaks (CSS)
  - `snow` → drifting snowflakes (CSS)
  - `fog` → translucent haze layer
  - `storm` → clouds + rain + occasional flash keyframe
- **Content:** temperature (monospace accent), `label`, condition text. If
  `weather.error` or empty → a muted static "Weather unavailable" band (still
  shows sky-by-clock if we have local time; no crash).
- **Accessibility:** all motion inside `@media (prefers-reduced-motion: reduce)`
  is disabled — the band renders a static frame (correct sky + celestial
  position, no drift/particles). `aria-label` summarizing temp + condition.

Keep each file focused and under 500 lines; `ConditionFX` variants may live in
one file with a `keyframes` block since they share structure.

## D. Modal integration + sizing

In `TodayBriefing.tsx`:

- Replace the weather placeholder Box (lines ~59-64) with
  `<WeatherBand weather={weather} />`, fetching via `getWeather` (`useQuery`
  keyed `['weather', lat, lon]`, enabled once location resolves).
- **Sizing tweak:** change `<Dialog ... fullScreen>` to
  `<Dialog ... maxWidth="xl" fullWidth>` and set the paper `sx` to
  `{ height: '92vh', m: 'auto' }` (mostly full-screen, centered, inset).
  Update the inner `Box` height from `100vh` to `100%`.

## E. Settings

Add a "Weather location" section to `Settings.tsx`: three inputs (latitude,
longitude, label) bound to `weather_lat`/`weather_lon`/`weather_label` via the
existing config setter. Basic client validation (numeric lat/lon in range).
This is the geolocation fallback the user can edit.

## F. Testing

- **`lib/weather.py`:** `classify_code` across representative WMO codes
  (clear/clouds/fog/drizzle/rain/snow/showers/storm/unknown); `normalize`
  maps fields + defensive on missing keys.
- **`/api/weather`:** cache miss fetches (urllib mocked) → normalized payload;
  cache hit within TTL skips fetch; bad coords → 400; upstream error →
  200 with `error` envelope (never 5xx).
- **Frontend:**
  - `useWeatherLocation` decision function: geo success → geo coords; geo
    denied/absent → config fallback.
  - `skyPhase` + `arcFraction` pure math (dawn/day/dusk/night; sunrise/noon/
    sunset/midnight positions).
  - `WeatherBand` renders per condition; `error` payload → unavailable state;
    reduced-motion path renders static (assert no animation classes / a
    `data-static` flag).

## Out of scope (SP2)

- SP3 finance section (separate placeholder).
- Multi-day forecast, hourly detail, weather alerts.
- Persisting geolocation across sessions (re-asked per open; config is the
  durable fallback).
- Multi-worker-safe weather cache (process-local dict is sufficient now).
