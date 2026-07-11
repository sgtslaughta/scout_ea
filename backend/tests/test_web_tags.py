from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    cursor = conn.execute("INSERT INTO people (name) VALUES ('Ada')")
    conn.commit()
    ada_id = cursor.lastrowid
    return TestClient(create_app(p)), ada_id


def test_tag_and_link_roundtrip(tmp_path):
    c, ada_id = _client(tmp_path)
    assert c.post("/api/content/task/1/tags", json={"name": "urgent", "color": "amber"}).json() == {"ok": True}
    assert c.post("/api/content/task/1/links", json={"target_type": "person", "target_id": ada_id}).json() == {"ok": True}
    refs = c.get("/api/content/task/1/refs").json()
    assert refs["tags"][0]["name"] == "urgent" and refs["tags"][0]["color"] == "amber"
    assert refs["links"][0]["label"] == "Ada"
    # tag appears in the global list
    assert any(t["name"] == "urgent" for t in c.get("/api/tags").json())
    # delete tag + link
    tag_id = refs["tags"][0]["tag_id"]
    link_id = refs["links"][0]["id"]
    assert c.delete(f"/api/content/task/1/tags/{tag_id}").json() == {"deleted": 1}
    assert c.delete(f"/api/content/task/1/links/{link_id}").json() == {"deleted": 1}
    refs2 = c.get("/api/content/task/1/refs").json()
    assert refs2 == {"tags": [], "links": []}


def test_bad_ref_type_400(tmp_path):
    c, _ = _client(tmp_path)
    assert c.post("/api/content/wormhole/1/tags", json={"name": "x"}).status_code == 400


def test_missing_delete_404(tmp_path):
    c, _ = _client(tmp_path)
    assert c.delete("/api/content/task/1/links/999").status_code == 404
