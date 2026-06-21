from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_health(tmp_path):
    r = _client(tmp_path).get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_config_returns_seeded_keys(tmp_path):
    r = _client(tmp_path).get("/api/config")
    assert r.status_code == 200
    body = r.json()
    assert body["tz"] == "America/New_York"
    assert "web_port" in body
