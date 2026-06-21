from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_set_writable_config(tmp_path):
    c = _client(tmp_path)
    r = c.post("/api/config/deadlines_visible_global", json={"value": "0"})
    assert r.status_code == 200
    assert c.get("/api/config").json()["deadlines_visible_global"] == "0"


def test_set_unwritable_config_400(tmp_path):
    r = _client(tmp_path).post("/api/config/db_path", json={"value": "/etc/x"})
    assert r.status_code == 400


def test_global_toggle_hides_deadlines(tmp_path):
    c = _client(tmp_path)
    c.post("/api/deadlines", json={"title": "X", "due_at": "2099-01-01T17:00:00+00:00"})
    c.post("/api/config/deadlines_visible_global", json={"value": "0"})
    assert c.get("/api/deadlines").json() == []
