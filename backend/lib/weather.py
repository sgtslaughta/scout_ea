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
