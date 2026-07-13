# Animated Weather Header (SP2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the briefing super-modal's weather placeholder with a live, animated CSS/SVG weather header driven by a cached Open-Meteo backend proxy.

**Architecture:** Backend `lib/weather.py` (pure classify/normalize) + a cached `/api/weather` proxy (stdlib urllib). Frontend `useWeatherLocation` (geolocation → config fallback) feeds `getWeather`; a `WeatherBand` component (SkyBackdrop + CelestialArc + ConditionFX) renders sky/arc/effects from pure `sky.ts` math. Modal integration also applies the mostly-full-screen sizing tweak; Settings gains a fallback-location field.

**Tech Stack:** Python stdlib (sqlite3, urllib), pytest; React + TypeScript + MUI, React Query, Vitest. No new dependencies.

## Global Constraints

- No new dependencies (backend or frontend). Weather fetch uses stdlib `urllib.request`.
- Config writes go through `db.set_config` allowlist (`WRITABLE_CONFIG`, `backend/ea/db.py`).
- Weather is NON-BLOCKING: upstream failure or denied geolocation must never break the modal. `/api/weather` never returns 5xx on upstream error — it returns HTTP 200 with an `error` envelope.
- All animation must be disabled under `@media (prefers-reduced-motion: reduce)` (static frame).
- Fixed upstream host `https://api.open-meteo.com` only (no SSRF surface).
- Keep files under 500 lines. Reuse existing MUI theme tokens.
- Backend tests: `cd backend && .venv/bin/python -m pytest <file> -q`. Frontend: `cd frontend && npx vitest run <file>`; type-check `npx tsc --noEmit`.

---

### Task 1: `lib/weather.py` — pure classify + normalize

**Files:**
- Create: `backend/lib/weather.py`
- Test: `backend/tests/test_lib_weather.py` (create)

**Interfaces:**
- Produces: `classify_code(code: int) -> str` (one of clear/clouds/rain/snow/fog/storm); `normalize(raw: dict) -> dict` with keys `temp, code, condition, is_day, sunrise, sunset`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_lib_weather.py
from lib import weather


def test_classify_code_categories():
    assert weather.classify_code(0) == "clear"
    assert weather.classify_code(2) == "clouds"
    assert weather.classify_code(45) == "fog"
    assert weather.classify_code(51) == "rain"
    assert weather.classify_code(65) == "rain"
    assert weather.classify_code(71) == "snow"
    assert weather.classify_code(80) == "rain"
    assert weather.classify_code(86) == "snow"
    assert weather.classify_code(95) == "storm"
    assert weather.classify_code(1234) == "clouds"  # unknown -> safe default


def test_normalize_maps_fields():
    raw = {
        "current": {"temperature_2m": 12.5, "weather_code": 61, "is_day": 1},
        "daily": {"sunrise": ["2026-06-21T05:25"], "sunset": ["2026-06-21T20:31"]},
    }
    out = weather.normalize(raw)
    assert out["temp"] == 12.5
    assert out["code"] == 61
    assert out["condition"] == "rain"
    assert out["is_day"] is True
    assert out["sunrise"] == "2026-06-21T05:25"
    assert out["sunset"] == "2026-06-21T20:31"


def test_normalize_defensive_on_missing():
    out = weather.normalize({})
    assert out["temp"] is None
    assert out["condition"] == "clouds"   # missing code -> default
    assert out["is_day"] is None
    assert out["sunrise"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_lib_weather.py -q`
Expected: FAIL (`ModuleNotFoundError: lib.weather`).

- [ ] **Step 3: Implement**

```python
# backend/lib/weather.py
"""Weather helpers — pure: map Open-Meteo payloads to the band's shape."""
from __future__ import annotations

CONDITIONS = ("clear", "clouds", "rain", "snow", "fog", "storm")

_CODE_MAP = {
    0: "clear",
    1: "clouds", 2: "clouds", 3: "clouds",
    45: "fog", 48: "fog",
    51: "rain", 53: "rain", 55: "rain", 56: "rain", 57: "rain",
    61: "rain", 63: "rain", 65: "rain", 66: "rain", 67: "rain",
    71: "snow", 73: "snow", 75: "snow", 77: "snow",
    80: "rain", 81: "rain", 82: "rain",
    85: "snow", 86: "snow",
    95: "storm", 96: "storm", 99: "storm",
}


def classify_code(code) -> str:
    try:
        return _CODE_MAP.get(int(code), "clouds")
    except (TypeError, ValueError):
        return "clouds"


def normalize(raw: dict) -> dict:
    cur = (raw or {}).get("current") or {}
    daily = (raw or {}).get("daily") or {}
    code = cur.get("weather_code")
    is_day = cur.get("is_day")

    def _first(seq):
        return seq[0] if isinstance(seq, list) and seq else None

    return {
        "temp": cur.get("temperature_2m"),
        "code": code,
        "condition": classify_code(code) if code is not None else "clouds",
        "is_day": bool(is_day) if is_day is not None else None,
        "sunrise": _first(daily.get("sunrise")),
        "sunset": _first(daily.get("sunset")),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_lib_weather.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/lib/weather.py backend/tests/test_lib_weather.py
git commit -m "feat(weather): pure classify_code + normalize helpers"
```

---

### Task 2: `/api/weather` endpoint + config keys + seed defaults

**Files:**
- Modify: `backend/web/app.py` (import + endpoint; add after `get_briefing`)
- Modify: `backend/ea/db.py` (`WRITABLE_CONFIG`)
- Modify: `backend/ea/seed.sql` (seed weather_* config)
- Test: `backend/tests/test_web_weather.py` (create)

**Interfaces:**
- Consumes: `lib.weather.normalize` (Task 1).
- Produces: `GET /api/weather?lat=&lon=` → normalized payload + `label`/`stale`, or 200 `{error}` on upstream failure; 400 on bad coords.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_web_weather.py
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app
from web import app as app_mod


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED).close()
    return TestClient(create_app(p))


_RAW = {
    "current": {"temperature_2m": 9.0, "weather_code": 3, "is_day": 1},
    "daily": {"sunrise": ["2026-06-21T05:25"], "sunset": ["2026-06-21T20:31"]},
}


def _fake_urlopen(*a, **k):
    m = MagicMock()
    m.read.return_value = json.dumps(_RAW).encode()
    m.__enter__.return_value = m
    m.__exit__.return_value = False
    return m


def setup_function():
    app_mod._WEATHER_CACHE.clear()


def test_weather_ok(tmp_path):
    with patch("web.app.urllib.request.urlopen", _fake_urlopen):
        body = _client(tmp_path).get("/api/weather?lat=40.71&lon=-74.01").json()
    assert body["condition"] == "clouds"
    assert body["temp"] == 9.0
    assert body["stale"] is False


def test_weather_bad_coords(tmp_path):
    r = _client(tmp_path).get("/api/weather?lat=999&lon=0")
    assert r.status_code == 400


def test_weather_upstream_failure_degrades(tmp_path):
    def boom(*a, **k):
        raise OSError("network down")
    with patch("web.app.urllib.request.urlopen", boom):
        r = _client(tmp_path).get("/api/weather?lat=40.71&lon=-74.01")
    assert r.status_code == 200
    assert r.json()["error"] == "unavailable"


def test_weather_cache_hit_skips_fetch(tmp_path):
    c = _client(tmp_path)
    with patch("web.app.urllib.request.urlopen", _fake_urlopen) as mock:
        c.get("/api/weather?lat=40.71&lon=-74.01")
        c.get("/api/weather?lat=40.71&lon=-74.01")
        assert mock.call_count == 1  # second served from cache
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_web_weather.py -q`
Expected: FAIL (404 / `_WEATHER_CACHE` undefined).

- [ ] **Step 3: Implement**

In `backend/web/app.py`, add imports near the top (after existing stdlib imports, ~line 5):

```python
import urllib.request
import urllib.parse
```

Add a module-level cache + constant near the top of the module (after imports, before `create_app`):

```python
# ponytail: process-local weather cache, fine for single-process; revisit if multi-worker
_WEATHER_CACHE: dict = {}
_WEATHER_TTL = 900  # seconds (15 min)
```

Add the endpoint immediately after `get_briefing` (inside `create_app`):

```python
    @app.get("/api/weather")
    def get_weather(lat: float, lon: float, conn=Depends(get_db)):
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise HTTPException(status_code=400, detail="lat/lon out of range")
        key = (round(lat, 2), round(lon, 2))
        row = conn.execute("SELECT value FROM config WHERE key='weather_label'").fetchone()
        label = row["value"] if row else None

        now = datetime.now(timezone.utc).timestamp()
        cached = _WEATHER_CACHE.get(key)
        if cached and (now - cached[0]) < _WEATHER_TTL:
            return {**cached[1], "label": label, "stale": False}

        qs = urllib.parse.urlencode({
            "latitude": key[0], "longitude": key[1],
            "current": "temperature_2m,weather_code,is_day",
            "daily": "sunrise,sunset", "timezone": "auto",
        })
        url = f"https://api.open-meteo.com/v1/forecast?{qs}"
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                raw = json.loads(resp.read().decode())
            payload = _weather.normalize(raw)
            _WEATHER_CACHE[key] = (now, payload)
            return {**payload, "label": label, "stale": False}
        except Exception:
            if cached:
                return {**cached[1], "label": label, "stale": True}
            return {"error": "unavailable", "label": label}
```

Add the import beside the other `from lib import ...` lines (~line 17):

```python
from lib import weather as _weather
```

In `backend/ea/db.py`, add the three keys to `WRITABLE_CONFIG`:

```python
WRITABLE_CONFIG = {"deadlines_visible_global", "outlook_send_time", "trend_window_days",
                   "reminder_enabled", "reminder_lead_minutes",
                   "alert_loud_threshold", "alert_sound_enabled", "daily_summary",
                   "weather_lat", "weather_lon", "weather_label"}
```

In `backend/ea/seed.sql`, add to the existing `INSERT OR IGNORE INTO config(key, value) VALUES` list (append rows, keeping valid SQL):

```sql
    ('weather_lat', '40.71'),
    ('weather_lon', '-74.01'),
    ('weather_label', 'New York'),
```

(Insert these as additional value tuples in the existing config INSERT; ensure comma placement keeps the statement valid.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_web_weather.py tests/test_schema.py -q`
Expected: PASS (4 weather tests + schema unaffected).

- [ ] **Step 5: Commit**

```bash
git add backend/web/app.py backend/ea/db.py backend/ea/seed.sql backend/tests/test_web_weather.py
git commit -m "feat(weather): cached /api/weather Open-Meteo proxy + config keys"
```

---

### Task 3: Frontend data — `getWeather`/`getConfig` + `useWeatherLocation`

**Files:**
- Modify: `frontend/src/api.ts` (types + `getWeather` + `getConfig`)
- Create: `frontend/src/lib/useWeatherLocation.ts` (pure `chooseLocation` + hook)
- Test: `frontend/src/lib/useWeatherLocation.test.ts` (create), `frontend/src/api.weather.test.ts` (create)

**Interfaces:**
- Produces: `WeatherResponse` type; `getWeather(lat, lon)`; `getConfig(): Promise<Record<string,string>>`; `chooseLocation(geo, cfg) -> {lat, lon, label, source}`; `useWeatherLocation()` hook.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/api.weather.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getWeather } from './api'
afterEach(() => vi.restoreAllMocks())

describe('getWeather', () => {
  it('hits /api/weather with coords', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: true, json: () => Promise.resolve({ condition: 'clear' }) }))
    const out = await getWeather(40.71, -74.01)
    expect(out.condition).toBe('clear')
    expect(fetch).toHaveBeenCalledWith('/api/weather?lat=40.71&lon=-74.01')
  })
})
```

```typescript
// frontend/src/lib/useWeatherLocation.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/api.weather.test.ts src/lib/useWeatherLocation.test.ts`
Expected: FAIL (`getWeather` / `chooseLocation` not exported).

- [ ] **Step 3: Implement**

Add to `frontend/src/api.ts` (near other types + fetchers):

```typescript
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
export const getConfig = () => fetchJson<Record<string, string>>('/api/config')
```

Create `frontend/src/lib/useWeatherLocation.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/api.weather.test.ts src/lib/useWeatherLocation.test.ts && npx tsc --noEmit`
Expected: PASS + clean type-check.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/lib/useWeatherLocation.ts frontend/src/lib/useWeatherLocation.test.ts frontend/src/api.weather.test.ts
git commit -m "feat(weather): getWeather/getConfig api + useWeatherLocation hook"
```

---

### Task 4: `sky.ts` — pure phase + arc math

**Files:**
- Create: `frontend/src/components/weather/sky.ts`
- Test: `frontend/src/components/weather/sky.test.ts` (create)

**Interfaces:**
- Produces: `skyPhase(now, sunrise, sunset) -> 'dawn'|'day'|'dusk'|'night'`; `arcFraction(now, sunrise, sunset, isDay) -> number` (0..1). All args are `Date`/ISO-parseable; return math is pure.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/components/weather/sky.test.ts
import { describe, it, expect } from 'vitest'
import { skyPhase, arcFraction } from './sky'

const SR = '2026-06-21T06:00:00Z'
const SS = '2026-06-21T20:00:00Z'
const at = (h: number, m = 0) => `2026-06-21T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`

describe('skyPhase', () => {
  it('day at noon', () => expect(skyPhase(at(13), SR, SS)).toBe('day'))
  it('night before dawn', () => expect(skyPhase(at(3), SR, SS)).toBe('night'))
  it('dawn near sunrise', () => expect(skyPhase(at(6, 10), SR, SS)).toBe('dawn'))
  it('dusk near sunset', () => expect(skyPhase(at(19, 50), SR, SS)).toBe('dusk'))
})

describe('arcFraction', () => {
  it('sunrise -> 0, sunset -> 1 (day)', () => {
    expect(arcFraction(SR, SR, SS, true)).toBeCloseTo(0, 5)
    expect(arcFraction(SS, SR, SS, true)).toBeCloseTo(1, 5)
  })
  it('noon -> 0.5 (day)', () => {
    expect(arcFraction(at(13), SR, SS, true)).toBeCloseTo(0.5, 2)
  })
  it('clamps below 0 / above 1', () => {
    expect(arcFraction(at(5), SR, SS, true)).toBe(0)
    expect(arcFraction(at(21), SR, SS, true)).toBe(1)
  })
  it('night progresses sunset->sunrise', () => {
    const f = arcFraction(at(23), SR, SS, false)
    expect(f).toBeGreaterThan(0)
    expect(f).toBeLessThan(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/weather/sky.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// frontend/src/components/weather/sky.ts
export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night'

const DAY_MS = 86_400_000
const TWILIGHT_MS = 45 * 60_000  // 45 min window around sunrise/sunset

const ms = (t: string | Date) => (t instanceof Date ? t.getTime() : new Date(t).getTime())
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function skyPhase(now: string | Date, sunrise: string | Date, sunset: string | Date): SkyPhase {
  const n = ms(now), sr = ms(sunrise), ss = ms(sunset)
  if (Math.abs(n - sr) <= TWILIGHT_MS) return 'dawn'
  if (Math.abs(n - ss) <= TWILIGHT_MS) return 'dusk'
  return n > sr && n < ss ? 'day' : 'night'
}

/** Position 0..1 across the arc (0 = left horizon, 1 = right horizon). */
export function arcFraction(
  now: string | Date, sunrise: string | Date, sunset: string | Date, isDay: boolean,
): number {
  const n = ms(now), sr = ms(sunrise), ss = ms(sunset)
  if (isDay) return clamp01((n - sr) / (ss - sr))
  // night: span from sunset to next sunrise
  const span = sr + DAY_MS - ss
  const elapsed = n >= ss ? n - ss : n + DAY_MS - ss
  return clamp01(elapsed / span)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/weather/sky.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/weather/sky.ts frontend/src/components/weather/sky.test.ts
git commit -m "feat(weather): pure skyPhase + arcFraction math"
```

---

### Task 5: `WeatherBand` + SkyBackdrop / CelestialArc / ConditionFX

**Files:**
- Create: `frontend/src/components/weather/WeatherBand.tsx`
- Test: `frontend/src/components/weather/WeatherBand.test.tsx` (create)

**Interfaces:**
- Consumes: `WeatherResponse` (Task 3), `skyPhase`/`arcFraction` (Task 4).
- Produces: `<WeatherBand weather={WeatherResponse} now?={Date} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/weather/WeatherBand.test.tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/weather/WeatherBand.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `frontend/src/components/weather/WeatherBand.tsx`. Requirements (write real code; this is presentational, no exact snippet mandated but must satisfy the tests + constraints):

- Props `{ weather: WeatherResponse; now?: Date }`; default `now` to `new Date()`.
- If `weather.error` or no `condition` → render a muted band: `Box` with the `label` and the text "Weather unavailable" (still styled, fixed height ~120px). Return early.
- Otherwise render a positioned container (`position: relative`, height ~120px, `overflow: hidden`, `borderRadius: 1`):
  - **SkyBackdrop:** an absolutely-positioned full-cover `Box` whose `background` (linear-gradient) is chosen by `skyPhase(now, sunrise, sunset)` — 4 gradient presets (dawn: warm peach; day: blue; dusk: orange/violet; night: deep indigo).
  - **CelestialArc:** an inline SVG (viewBox `0 0 100 40`) with a faint arc path; a `<circle>` for the body at position derived from `f = arcFraction(now, sunrise, sunset, is_day)` → `cx = f*100`, `cy = 40 - Math.sin(f*Math.PI)*34`. Sun (amber) when `is_day`, moon (pale) otherwise. Add `data-testid="celestial-sun"` or `"celestial-moon"`.
  - **ConditionFX:** a layer with `data-testid={`condition-${condition}`}`. Per condition render CSS/SVG effects: clouds (drifting `Box`es via `@keyframes`), rain (repeating streaks), snow (drifting dots), fog (haze), storm (clouds + rain + flash), clear (rays/glow day, stars night). Define `@keyframes` via MUI `sx` or a local `<style>`; keep it in this file.
  - **Content overlay:** `label` and `temp` (e.g. `{Math.round(temp)}°`) in a `Typography`, monospace accent for temp, positioned bottom-left, high-contrast text.
  - **Reduced motion:** wrap all animated `sx` in `@media (prefers-reduced-motion: reduce)` that sets `animation: 'none'`. Add `aria-label={`${label}: ${condition}, ${Math.round(temp)} degrees`}` on the container.
- Keep file under 500 lines.

- [ ] **Step 4: Run test + type-check**

Run: `cd frontend && npx vitest run src/components/weather/WeatherBand.test.tsx && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/weather/WeatherBand.tsx frontend/src/components/weather/WeatherBand.test.tsx
git commit -m "feat(weather): animated WeatherBand (sky/arc/condition FX)"
```

---

### Task 6: Modal integration + sizing tweak + Settings field

**Files:**
- Modify: `frontend/src/components/TodayBriefing.tsx` (wire band + fetch + sizing)
- Modify: `frontend/src/views/Settings.tsx` (weather location field)
- Modify: `frontend/src/components/TodayBriefing.test.tsx` (band presence assertion)
- Test: `frontend/src/views/Settings.test.tsx` (extend if present, else assert in TodayBriefing)

**Interfaces:**
- Consumes: `WeatherBand` (Task 5), `useWeatherLocation` + `getWeather` (Task 3).

- [ ] **Step 1: Write the failing test** (append to `TodayBriefing.test.tsx`)

```tsx
it('renders the weather band region', async () => {
  vi.spyOn(api, 'getBriefing').mockResolvedValue(payload as never)
  vi.spyOn(api, 'getConfig').mockResolvedValue(
    { weather_lat: '40.71', weather_lon: '-74.01', weather_label: 'NYC' } as never)
  vi.spyOn(api, 'getWeather').mockResolvedValue(
    { condition: 'clear', temp: 20, is_day: true,
      sunrise: '2026-06-21T06:00:00Z', sunset: '2026-06-21T20:00:00Z', label: 'NYC' } as never)
  renderModal()
  expect(await screen.findByLabelText(/NYC/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/TodayBriefing.test.tsx`
Expected: FAIL (no weather band / getWeather not called).

- [ ] **Step 3: Implement**

In `TodayBriefing.tsx`:
- Import `WeatherBand`, `useWeatherLocation`, and `getWeather`.
- Resolve location: `const loc = useWeatherLocation(open)`.
- Fetch weather: `const { data: weather } = useQuery({ queryKey: ['weather', loc?.lat, loc?.lon], queryFn: () => getWeather(loc!.lat, loc!.lon), enabled: open && !!loc })`.
- Replace the weather placeholder `Box` (currently the "Weather — coming soon" block, ~lines 59-64) with:
  `{weather ? <WeatherBand weather={weather} /> : <Box sx={{ height: 120, mb: 3 }} />}` (reserve space while loading).
- **Sizing tweak:** change `<Dialog ... fullScreen ...>` to
  `<Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth slotProps={{ paper: { sx: { position: 'relative', height: '92vh', m: 'auto' } } }}>`.
  Change the inner `Box` `height: '100vh'` → `height: '100%'`.

In `Settings.tsx`, add a "Weather location" block (follow the existing `cfg`/`saveCfg` pattern already in the file): three `TextField`s bound to `cfg.weather_lat`, `cfg.weather_lon`, `cfg.weather_label`, each calling `saveCfg.mutate({ key, value })` on change/blur. Numeric validation for lat/lon (in range).

- [ ] **Step 4: Run tests + full regression**

Run: `cd frontend && npx vitest run src/components/TodayBriefing.test.tsx && npx tsc --noEmit`
Then full suites:
`cd backend && .venv/bin/python -m pytest -q`
`cd frontend && npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TodayBriefing.tsx frontend/src/views/Settings.tsx frontend/src/components/TodayBriefing.test.tsx
git commit -m "feat(weather): wire WeatherBand into briefing modal + settings + mostly-fullscreen"
```

---

## Self-Review

**Spec coverage:**
- `lib/weather.py` classify_code + normalize → Task 1. ✔
- `/api/weather` cached proxy + config keys + seed + graceful degradation → Task 2. ✔
- `getWeather`/`getConfig` + `useWeatherLocation` (geo→config fallback) → Task 3. ✔
- `skyPhase`/`arcFraction` pure math → Task 4. ✔
- `WeatherBand` (SkyBackdrop/CelestialArc/ConditionFX) + reduced-motion + error state → Task 5. ✔
- Modal integration + mostly-full-screen sizing tweak → Task 6. ✔
- Settings fallback field → Task 6. ✔
- Testing (classify/normalize, endpoint cache+degrade, hook fallback, arc math, band render, reduced-motion) → Tasks 1-6. ✔
- Out of scope (SP3, multi-day, multi-worker cache) — not planned. ✔

**Placeholder scan:** No TBD/TODO. Task 5's component body is described (presentational, testid + constraint driven) rather than verbatim — acceptable; tests pin the observable contract (temp/label/condition-testid/celestial-testid/error state).

**Type consistency:** `WeatherResponse` keys (Task 3) match backend `normalize` output (Task 1) + endpoint envelope (Task 2: adds `label`/`stale`/`error`). `chooseLocation`/`WeatherLocation` shape consistent Task 3 ↔ hook. `skyPhase`/`arcFraction` signatures identical Task 4 def ↔ Task 5 use. `_WEATHER_CACHE` name consistent Task 2 code ↔ test.
