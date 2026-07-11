import pytest
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_add_deadline_dedups(tmp_path):
    conn = _conn(tmp_path)
    f = dict(title="Q3 deck", due_at="2026-06-24T17:00:00+00:00",
             source="email", external_ref="msg-9")
    assert db.add_deadline(conn, **f) == 1
    assert db.add_deadline(conn, **f) == 0
    assert conn.execute("SELECT COUNT(*) FROM critical_deadlines").fetchone()[0] == 1


def test_add_deadline_requires_external_ref(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="external_ref"):
        db.add_deadline(conn, title="x", due_at="2026-06-24T17:00:00+00:00", source="manual")


def test_list_deadlines_hides_invisible_row(tmp_path):
    conn = _conn(tmp_path)
    db.add_deadline(conn, title="A", due_at="2026-06-24T17:00:00+00:00",
                    source="email", external_ref="a")
    db.add_deadline(conn, title="B", due_at="2026-06-23T17:00:00+00:00",
                    source="email", external_ref="b")
    db.set_deadline_visible(conn, 1, 0)
    rows = db.list_deadlines(conn)
    # only B visible; ordered by due_at asc
    assert [r["external_ref"] for r in rows] == ["b"]


def test_list_deadlines_global_toggle_off(tmp_path):
    conn = _conn(tmp_path)
    db.add_deadline(conn, title="A", due_at="2026-06-24T17:00:00+00:00",
                    source="email", external_ref="a")
    conn.execute("UPDATE config SET value='0' WHERE key='deadlines_visible_global'")
    conn.commit()
    assert db.list_deadlines(conn) == []
    assert db.list_deadlines(conn, respect_global=False) != []


def _one_deadline(conn):
    db.add_deadline(conn, title="A", due_at="2026-06-24T17:00:00+00:00",
                    source="email", external_ref="a")
    return conn.execute("SELECT id FROM critical_deadlines").fetchone()["id"]


def test_deadline_link_resolves_label_and_dedups(tmp_path):
    conn = _conn(tmp_path)
    did = _one_deadline(conn)
    conn.execute("INSERT INTO people (name) VALUES ('Ada')")
    conn.commit()
    pid = conn.execute("SELECT id FROM people WHERE name='Ada'").fetchone()["id"]
    assert db.add_deadline_link(conn, did, "person", pid) == 1
    assert db.add_deadline_link(conn, did, "person", pid) == 0  # idempotent
    links = db.list_deadline_links(conn, did)
    assert len(links) == 1 and links[0]["label"] == "Ada" and links[0]["ref_type"] == "person"
    assert db.del_deadline_link(conn, links[0]["id"]) == 1
    assert db.list_deadline_links(conn, did) == []


def test_deadline_link_rejects_bad_ref_type(tmp_path):
    conn = _conn(tmp_path)
    did = _one_deadline(conn)
    with pytest.raises(ValueError, match="ref_type"):
        db.add_deadline_link(conn, did, "wormhole", 1)


def test_deadline_tag_add_list_del(tmp_path):
    conn = _conn(tmp_path)
    did = _one_deadline(conn)
    assert db.add_deadline_tag(conn, did, " urgent ") == 1  # trimmed
    assert db.add_deadline_tag(conn, did, "urgent") == 0    # dup
    tags = db.list_deadline_tags(conn, did)
    assert [t["tag"] for t in tags] == ["urgent"]
    with pytest.raises(ValueError):
        db.add_deadline_tag(conn, did, "   ")
    assert db.del_deadline_tag(conn, tags[0]["id"]) == 1
    assert list(db.list_deadline_tags(conn, did)) == []
