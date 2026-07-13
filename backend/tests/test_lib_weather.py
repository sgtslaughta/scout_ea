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
