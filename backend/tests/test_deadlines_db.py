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


