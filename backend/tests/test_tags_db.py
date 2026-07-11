import pytest
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_get_or_create_tag_dedupes(tmp_path):
    conn = _conn(tmp_path)
    a = db.get_or_create_tag(conn, "security", "red")
    b = db.get_or_create_tag(conn, "security")
    assert a == b
    assert conn.execute("SELECT COUNT(*) FROM tags").fetchone()[0] == 1


def test_tag_content_idempotent_and_lists(tmp_path):
    conn = _conn(tmp_path)
    assert db.tag_content(conn, "task", 5, "urgent", "amber") == 1
    assert db.tag_content(conn, "task", 5, "urgent") == 0  # dup
    rows = db.list_tags_for(conn, "task", 5)
    assert len(rows) == 1 and rows[0]["name"] == "urgent" and rows[0]["color"] == "amber"
    assert "tag_id" in rows[0]


def test_tag_content_rejects_bad_ref_type(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="ref_type"):
        db.tag_content(conn, "wormhole", 1, "x")


def test_untag_and_content_ids_by_tag(tmp_path):
    conn = _conn(tmp_path)
    db.tag_content(conn, "task", 5, "urgent")
    db.tag_content(conn, "signal", 9, "urgent")
    tid = db.list_tags_for(conn, "task", 5)[0]["tag_id"]
    assert {(r["ref_type"], r["ref_id"]) for r in db.content_ids_by_tag(conn, tid)} == {("task", 5), ("signal", 9)}
    assert db.content_ids_by_tag(conn, tid, ref_type="task") == [{"ref_type": "task", "ref_id": 5}]
    assert db.untag_content(conn, "task", 5, tid) == 1
    assert db.list_tags_for(conn, "task", 5) == []


def test_empty_tag_name_rejected(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.get_or_create_tag(conn, "   ")
