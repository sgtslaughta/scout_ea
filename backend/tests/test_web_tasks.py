"""Tests for tasks REST API endpoints."""
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_patch_task_updates_fields(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)
    tid = db.add_task(conn, title="old", priority=3, status="open")
    c = TestClient(create_app(p))
    r = c.patch(f"/api/tasks/{tid}", json={"title": "new", "priority": 1})
    assert r.status_code == 200 and r.json() == {"updated": 1}
    row = db.get_conn(p).execute("SELECT title, priority FROM tasks WHERE id=?", (tid,)).fetchone()
    assert row["title"] == "new" and row["priority"] == 1


def test_patch_missing_task_404(tmp_path):
    r = _client(tmp_path).patch("/api/tasks/9999", json={"title": "x"})
    assert r.status_code == 404


def test_patch_empty_body_noop(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    tid = db.add_task(db.get_conn(p), title="t", priority=3, status="open")
    r = _client(tmp_path).patch(f"/api/tasks/{tid}", json={})
    assert r.status_code == 200 and r.json() == {"updated": 0}
