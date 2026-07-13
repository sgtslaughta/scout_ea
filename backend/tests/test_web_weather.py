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
    with patch("web.app.urllib.request.urlopen") as mock:
        mock.side_effect = _fake_urlopen
        c.get("/api/weather?lat=40.71&lon=-74.01")
        c.get("/api/weather?lat=40.71&lon=-74.01")
        assert mock.call_count == 1  # second served from cache
