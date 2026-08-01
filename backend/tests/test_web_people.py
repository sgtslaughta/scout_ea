"""Tests for people REST endpoints, especially channel handles.

The triage skills (email_preferred, chat_preferred, triage_email) match
incoming senders against `person_handles`. A person tracked from a dashboard
tile with only a display name would be invisible to all of them, so creating a
person with an address has to write a handle row.
"""
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_create_person_with_email_stores_a_handle(tmp_path):
    c = _client(tmp_path)
    pid = c.post("/api/people", json={
        "name": "Priya Raman", "email": "Priya.Raman@contoso.com",
    }).json()["id"]

    person = next(p for p in c.get("/api/people").json() if p["id"] == pid)
    assert {"channel": "email", "handle": "priya.raman@contoso.com"} in person["handles"]


def test_handles_are_lowercased_so_matching_is_case_insensitive(tmp_path):
    c = _client(tmp_path)
    c.post("/api/people", json={"name": "Mixed Case", "email": "MiXeD@Example.COM"})
    conn = db.get_conn(tmp_path / "ea.sqlite")
    assert db.find_person_by_handle(conn, "mixed@example.com")["name"] == "Mixed Case"


def test_tracking_a_known_address_twice_does_not_duplicate(tmp_path):
    c = _client(tmp_path)
    first = c.post("/api/people", json={"name": "Priya Raman", "email": "p@contoso.com"}).json()
    # Same address, different display name — people get renamed, addresses don't.
    second = c.post("/api/people", json={"name": "P. Raman", "email": "P@Contoso.com"}).json()
    assert second["id"] == first["id"]
    assert second.get("existing") is True


def test_teams_handle_is_stored_on_its_own_channel(tmp_path):
    c = _client(tmp_path)
    pid = c.post("/api/people", json={
        "name": "Chat Person", "teams_handle": "chat@example.com",
    }).json()["id"]
    person = next(p for p in c.get("/api/people").json() if p["id"] == pid)
    assert person["handles"] == [{"channel": "teams", "handle": "chat@example.com"}]


def test_people_without_handles_still_list_cleanly(tmp_path):
    c = _client(tmp_path)
    c.post("/api/people", json={"name": "No Handle"})
    people = c.get("/api/people").json()
    assert people and all(isinstance(p["handles"], list) for p in people)
