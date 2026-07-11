from fastapi.testclient import TestClient
from web.app import create_app


def _client(tmp_path):
    from ea import db
    p = tmp_path / "t.db"
    db.init_db(p)
    return TestClient(create_app(p))


def test_action_create_list_approve_dismiss(tmp_path):
    c = _client(tmp_path)
    r = c.post("/api/actions", json={"action_type": "email_new",
               "payload": {"to": "a@b.com"}, "rationale": "hi"})
    assert r.status_code == 200
    aid = r.json()["id"]
    lst = c.get("/api/actions?status=drafted").json()
    assert any(a["id"] == aid for a in lst)
    assert c.post(f"/api/actions/{aid}/approve").json()["updated"] == 1
    assert c.get("/api/actions?status=approved").json()[0]["id"] == aid
    assert c.post(f"/api/actions/{aid}/dismiss").json()["updated"] == 1
