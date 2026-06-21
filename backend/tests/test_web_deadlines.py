from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_post_and_list_deadline(tmp_path):
    c = _client(tmp_path)
    r = c.post("/api/deadlines",
               json={"title": "Q3 deck", "due_at": "2099-01-01T17:00:00+00:00"})
    assert r.status_code == 200
    did = r.json()["id"]
    assert did >= 1
    body = c.get("/api/deadlines").json()
    assert len(body) == 1
    assert body[0]["title"] == "Q3 deck"
    assert isinstance(body[0]["countdown_seconds"], int)
    assert body[0]["countdown_seconds"] > 0          # far-future due date


def test_visibility_toggle_hides_from_list(tmp_path):
    c = _client(tmp_path)
    did = c.post("/api/deadlines",
                 json={"title": "X", "due_at": "2099-01-01T17:00:00+00:00"}).json()["id"]
    assert c.post(f"/api/deadlines/{did}/visible", json={"visible": False}).json() == {"updated": 1}
    assert c.get("/api/deadlines").json() == []
    assert c.post(f"/api/deadlines/{did}/visible", json={"visible": True}).json() == {"updated": 1}
    assert len(c.get("/api/deadlines").json()) == 1


def test_visibility_missing_row_404(tmp_path):
    r = _client(tmp_path).post("/api/deadlines/999/visible", json={"visible": False})
    assert r.status_code == 404


def test_post_deadline_rejects_bad_due_at(tmp_path):
    c = _client(tmp_path)
    r = c.post("/api/deadlines", json={"title": "X", "due_at": "not-a-date"})
    assert r.status_code == 400


def test_post_deadline_naive_timezone_normalized_to_utc(tmp_path):
    """Naive datetime (no timezone) is treated as UTC and stored normalized."""
    c = _client(tmp_path)
    r = c.post("/api/deadlines",
               json={"title": "Naive deadline", "due_at": "2099-01-01T17:00:00"})
    assert r.status_code == 200
    did = r.json()["id"]
    # Retrieve and verify stored due_at ends with +00:00 (UTC)
    body = c.get("/api/deadlines").json()
    assert len(body) == 1
    stored_due_at = body[0]["due_at"]
    assert stored_due_at.endswith("+00:00"), f"Expected UTC offset, got {stored_due_at}"
    # Verify countdown is positive (far-future date)
    assert body[0]["countdown_seconds"] > 0
