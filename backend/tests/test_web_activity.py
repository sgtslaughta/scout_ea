from fastapi.testclient import TestClient
from ea import db
from web.app import create_app

def test_activity_endpoint(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.add_skill_run(conn, "daily_outlook", items_created=3, note="ok")
    conn.close()
    body = TestClient(create_app(p)).get("/api/activity").json()
    assert body[0]["skill"] == "daily_outlook"
    assert body[0]["items_created"] == 3
