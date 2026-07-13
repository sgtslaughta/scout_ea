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
    assert out["forecast"] == []
    assert out["unit"] == "C"


def test_normalize_forecast_and_unit():
    raw = {
        "current": {"temperature_2m": 70, "weather_code": 0, "is_day": 1},
        "daily": {
            "sunrise": ["2026-06-21T05:25"], "sunset": ["2026-06-21T20:31"],
            "time": ["2026-06-21", "2026-06-22", "2026-06-23"],
            "temperature_2m_max": [80, 82, 79],
            "temperature_2m_min": [60, 61, 58],
            "weather_code": [0, 61, 95],
        },
    }
    out = weather.normalize(raw, unit="F")
    assert out["unit"] == "F"
    assert len(out["forecast"]) == 3
    assert out["forecast"][0] == {"date": "2026-06-21", "hi": 80, "lo": 60, "condition": "clear"}
    assert out["forecast"][1]["condition"] == "rain"
    assert out["forecast"][2]["condition"] == "storm"
