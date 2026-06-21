"""Tests for people and topics database helpers."""
from ea import db
import pytest


def test_add_person_returns_id_and_persists(tmp_path):
    """add_person creates a person and returns its id."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    pid = db.add_person(conn, name="Alice Smith", role="Engineer", org="TechCorp", importance=2)
    assert pid >= 1
    row = conn.execute("SELECT * FROM people WHERE id=?", (pid,)).fetchone()
    assert row["name"] == "Alice Smith"
    assert row["role"] == "Engineer"
    assert row["org"] == "TechCorp"
    assert row["importance"] == 2
    assert row["active"] == 1


def test_list_people_excludes_inactive_by_default(tmp_path):
    """list_people returns only active people sorted by importance, name."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    # Add people with various importance levels
    p1 = db.add_person(conn, name="Zoe", importance=5)
    p2 = db.add_person(conn, name="Alice", importance=1)
    p3 = db.add_person(conn, name="Bob", importance=1)
    # Deactivate one
    db.deactivate_person(conn, p1)

    people = db.list_people(conn)
    names = [p["name"] for p in people]
    # Default list should exclude Zoe (inactive) and include seeded Dr. Vance
    assert "Zoe" not in names
    assert "Alice" in names
    assert "Bob" in names


def test_list_people_with_include_inactive(tmp_path):
    """list_people(include_inactive=True) returns all people."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    p1 = db.add_person(conn, name="Zoe", importance=5)
    p2 = db.add_person(conn, name="Alice", importance=1)
    db.deactivate_person(conn, p1)

    people = db.list_people(conn, include_inactive=True)
    names = [p["name"] for p in people]
    # Should include both active and inactive
    assert "Zoe" in names
    assert "Alice" in names


def test_update_person_modifies_fields(tmp_path):
    """update_person changes specified fields."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    pid = db.add_person(conn, name="Charlie", role="Manager", importance=3)

    rowcount = db.update_person(conn, pid, role="Director", importance=1)
    assert rowcount == 1

    row = conn.execute("SELECT * FROM people WHERE id=?", (pid,)).fetchone()
    assert row["role"] == "Director"
    assert row["importance"] == 1
    assert row["name"] == "Charlie"  # unchanged


def test_deactivate_person_sets_active_to_zero(tmp_path):
    """deactivate_person sets active=0."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    pid = db.add_person(conn, name="David")

    rowcount = db.deactivate_person(conn, pid)
    assert rowcount == 1

    row = conn.execute("SELECT active FROM people WHERE id=?", (pid,)).fetchone()
    assert row["active"] == 0


def test_add_person_unknown_column_raises(tmp_path):
    """add_person raises ValueError for unknown columns."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    with pytest.raises(ValueError, match="unknown person columns"):
        db.add_person(conn, name="Eve", invalid_field="bad")


def test_add_topic_returns_id_and_persists(tmp_path):
    """add_topic creates a topic and returns its id."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    tid = db.add_topic(conn, name="Quantum Computing", description="QC research", priority=1, max_suggest=3)
    assert tid >= 1
    row = conn.execute("SELECT * FROM topics WHERE id=?", (tid,)).fetchone()
    assert row["name"] == "Quantum Computing"
    assert row["description"] == "QC research"
    assert row["priority"] == 1
    assert row["max_suggest"] == 3
    assert row["active"] == 1


def test_list_topics_excludes_inactive_by_default(tmp_path):
    """list_topics returns only active topics sorted by priority, name."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    # Add topics
    t1 = db.add_topic(conn, name="Zebras", priority=5)
    t2 = db.add_topic(conn, name="Aardvarks", priority=1)
    t3 = db.add_topic(conn, name="Bats", priority=1)
    # Deactivate one
    db.deactivate_topic(conn, t1)

    topics = db.list_topics(conn)
    names = [t["name"] for t in topics]
    # Default list should exclude Zebras (inactive) and include seeded AI agents
    assert "Zebras" not in names
    assert "Aardvarks" in names
    assert "Bats" in names


def test_list_topics_with_include_inactive(tmp_path):
    """list_topics(include_inactive=True) returns all topics."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    t1 = db.add_topic(conn, name="Zebras", priority=5)
    t2 = db.add_topic(conn, name="Aardvarks", priority=1)
    db.deactivate_topic(conn, t1)

    topics = db.list_topics(conn, include_inactive=True)
    names = [t["name"] for t in topics]
    # Should include both active and inactive
    assert "Zebras" in names
    assert "Aardvarks" in names


def test_update_topic_modifies_fields(tmp_path):
    """update_topic changes specified fields."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    tid = db.add_topic(conn, name="Robotics", description="Robots", priority=3)

    rowcount = db.update_topic(conn, tid, description="Advanced Robotics", priority=1)
    assert rowcount == 1

    row = conn.execute("SELECT * FROM topics WHERE id=?", (tid,)).fetchone()
    assert row["description"] == "Advanced Robotics"
    assert row["priority"] == 1
    assert row["name"] == "Robotics"  # unchanged


def test_deactivate_topic_sets_active_to_zero(tmp_path):
    """deactivate_topic sets active=0."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    tid = db.add_topic(conn, name="Blockchain")

    rowcount = db.deactivate_topic(conn, tid)
    assert rowcount == 1

    row = conn.execute("SELECT active FROM topics WHERE id=?", (tid,)).fetchone()
    assert row["active"] == 0


def test_add_topic_unknown_column_raises(tmp_path):
    """add_topic raises ValueError for unknown columns."""
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    with pytest.raises(ValueError, match="unknown topic columns"):
        db.add_topic(conn, name="ML", unknown_field="bad")
