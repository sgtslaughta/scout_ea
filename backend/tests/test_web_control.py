from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.upsert_signal(conn, type="email", source="outlook", external_ref="a",
                     title="Alpha", status="new")
    conn.close()
    return TestClient(create_app(p))


def test_update_status_ok(tmp_path):
    c = _client(tmp_path)
    r = c.post("/api/signals/1/status", json={"status": "dismissed"})
    assert r.status_code == 200
    assert r.json() == {"updated": 1}
    assert c.get("/api/signals", params={"status": "new"}).json() == []


def test_update_status_unknown_table_400(tmp_path):
    r = _client(tmp_path).post("/api/people/1/status", json={"status": "x"})
    assert r.status_code == 400


def test_update_status_missing_row_404(tmp_path):
    r = _client(tmp_path).post("/api/signals/999/status", json={"status": "dismissed"})
    assert r.status_code == 404
