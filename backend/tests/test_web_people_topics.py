"""Tests for people and topics REST API endpoints."""
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app
import sqlite3


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_get_people_lists_active_people(tmp_path):
    """GET /api/people returns active people."""
    client = _client(tmp_path)
    r = client.get("/api/people")
    assert r.status_code == 200
    people = r.json()
    assert isinstance(people, list)
    names = [p["name"] for p in people]
    # Seeded Dr. Vance should be there
    assert "Dr. Vance" in names


def test_post_people_creates_person(tmp_path):
    """POST /api/people creates a person and returns its id."""
    client = _client(tmp_path)
    body = {
        "name": "Alice Smith",
        "role": "Engineer",
        "org": "TechCorp",
        "importance": 2,
        "notes": "Key contact"
    }
    r = client.post("/api/people", json=body)
    assert r.status_code == 200
    data = r.json()
    assert "id" in data
    pid = data["id"]

    # Verify in list
    r = client.get("/api/people")
    names = [p["name"] for p in r.json()]
    assert "Alice Smith" in names


def test_patch_people_updates_fields(tmp_path):
    """PATCH /api/people/{id} updates specified fields."""
    client = _client(tmp_path)
    # Create a person
    create_r = client.post("/api/people", json={"name": "Bob", "role": "Manager", "importance": 3})
    pid = create_r.json()["id"]

    # Patch
    r = client.patch(f"/api/people/{pid}", json={"role": "Director", "importance": 1})
    assert r.status_code == 200

    # Verify update
    r = client.get("/api/people")
    bob = [p for p in r.json() if p["id"] == pid][0]
    assert bob["role"] == "Director"
    assert bob["importance"] == 1
    assert bob["name"] == "Bob"  # unchanged


def test_patch_people_returns_404_if_not_found(tmp_path):
    """PATCH /api/people/{id} returns 404 if person not found."""
    client = _client(tmp_path)
    r = client.patch("/api/people/9999", json={"role": "Updated"})
    assert r.status_code == 404


def test_delete_people_deactivates_person(tmp_path):
    """DELETE /api/people/{id} soft-deletes (deactivates) a person."""
    client = _client(tmp_path)
    # Create a person
    create_r = client.post("/api/people", json={"name": "Charlie"})
    pid = create_r.json()["id"]

    # Delete
    r = client.delete(f"/api/people/{pid}")
    assert r.status_code == 200
    assert r.json()["deactivated"] == 1

    # Should not appear in default list
    r = client.get("/api/people")
    names = [p["name"] for p in r.json()]
    assert "Charlie" not in names


def test_delete_people_returns_404_if_not_found(tmp_path):
    """DELETE /api/people/{id} returns 404 if person not found."""
    client = _client(tmp_path)
    r = client.delete("/api/people/9999")
    assert r.status_code == 404


def test_get_people_include_inactive_query(tmp_path):
    """GET /api/people?include_inactive=true includes inactive people."""
    client = _client(tmp_path)
    # Create and deactivate a person
    create_r = client.post("/api/people", json={"name": "David"})
    pid = create_r.json()["id"]
    client.delete(f"/api/people/{pid}")

    # Default list should not include it
    r = client.get("/api/people")
    names = [p["name"] for p in r.json()]
    assert "David" not in names

    # With include_inactive it should be there
    r = client.get("/api/people?include_inactive=true")
    names = [p["name"] for p in r.json()]
    assert "David" in names


def test_get_topics_lists_active_topics(tmp_path):
    """GET /api/topics returns active topics."""
    client = _client(tmp_path)
    r = client.get("/api/topics")
    assert r.status_code == 200
    topics = r.json()
    assert isinstance(topics, list)
    names = [t["name"] for t in topics]
    # Seeded AI agents should be there
    assert "AI agents" in names


def test_post_topics_creates_topic(tmp_path):
    """POST /api/topics creates a topic and returns its id."""
    client = _client(tmp_path)
    body = {
        "name": "Quantum Computing",
        "description": "QC research",
        "priority": 1,
        "max_suggest": 3
    }
    r = client.post("/api/topics", json=body)
    assert r.status_code == 200
    data = r.json()
    assert "id" in data
    tid = data["id"]

    # Verify in list
    r = client.get("/api/topics")
    names = [t["name"] for t in r.json()]
    assert "Quantum Computing" in names


def test_post_topics_duplicate_name_returns_error(tmp_path):
    """POST /api/topics with duplicate name returns 409 or similar error."""
    client = _client(tmp_path)
    body = {"name": "Blockchain"}
    r = client.post("/api/topics", json=body)
    assert r.status_code == 200

    # Try duplicate
    r = client.post("/api/topics", json=body)
    # Should not 500; expect 409 (Conflict) or similar
    assert r.status_code != 500
    assert r.status_code in [409, 400]


def test_patch_topics_updates_fields(tmp_path):
    """PATCH /api/topics/{id} updates specified fields."""
    client = _client(tmp_path)
    # Create a topic
    create_r = client.post("/api/topics", json={"name": "Robotics", "description": "Robots", "priority": 3})
    tid = create_r.json()["id"]

    # Patch
    r = client.patch(f"/api/topics/{tid}", json={"description": "Advanced Robotics", "priority": 1})
    assert r.status_code == 200

    # Verify update
    r = client.get("/api/topics")
    robotics = [t for t in r.json() if t["id"] == tid][0]
    assert robotics["description"] == "Advanced Robotics"
    assert robotics["priority"] == 1
    assert robotics["name"] == "Robotics"  # unchanged


def test_patch_topics_returns_404_if_not_found(tmp_path):
    """PATCH /api/topics/{id} returns 404 if topic not found."""
    client = _client(tmp_path)
    r = client.patch("/api/topics/9999", json={"description": "Updated"})
    assert r.status_code == 404


def test_delete_topics_deactivates_topic(tmp_path):
    """DELETE /api/topics/{id} soft-deletes (deactivates) a topic."""
    client = _client(tmp_path)
    # Create a topic
    create_r = client.post("/api/topics", json={"name": "Blockchain"})
    tid = create_r.json()["id"]

    # Delete
    r = client.delete(f"/api/topics/{tid}")
    assert r.status_code == 200
    assert r.json()["deactivated"] == 1

    # Should not appear in default list
    r = client.get("/api/topics")
    names = [t["name"] for t in r.json()]
    assert "Blockchain" not in names


def test_delete_topics_returns_404_if_not_found(tmp_path):
    """DELETE /api/topics/{id} returns 404 if topic not found."""
    client = _client(tmp_path)
    r = client.delete("/api/topics/9999")
    assert r.status_code == 404


def test_get_topics_include_inactive_query(tmp_path):
    """GET /api/topics?include_inactive=true includes inactive topics."""
    client = _client(tmp_path)
    # Create and deactivate a topic
    create_r = client.post("/api/topics", json={"name": "Machine Learning"})
    tid = create_r.json()["id"]
    client.delete(f"/api/topics/{tid}")

    # Default list should not include it
    r = client.get("/api/topics")
    names = [t["name"] for t in r.json()]
    assert "Machine Learning" not in names

    # With include_inactive it should be there
    r = client.get("/api/topics?include_inactive=true")
    names = [t["name"] for t in r.json()]
    assert "Machine Learning" in names
