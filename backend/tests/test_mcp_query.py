import pytest
from ea import db
from mcp_server import tools as mcp_tools


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_query_filter_and_limit(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="o", external_ref="m1",
                     title="A", status="new", topic_id=1)
    db.upsert_signal(conn, type="email", source="o", external_ref="m2",
                     title="B", status="dismissed", topic_id=1)
    rows = db.query(conn, "signals", filters={"status": "new"})
    assert [r["external_ref"] for r in rows] == ["m1"]
    assert db.query(conn, "signals", limit=1) and len(db.query(conn, "signals", limit=1)) == 1


def test_query_rejects_unknown_table(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.query(conn, "sqlite_master")


def test_query_rejects_unknown_column(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.query(conn, "signals", filters={"drop_me": 1})


def test_query_op_and_in_and_caps_limit(tmp_path):
    conn = _conn(tmp_path)
    for i in range(3):
        db.upsert_signal(conn, type="email", source="o",
                         external_ref=f"m{i}", title="T", priority=i + 1)
    hi = db.query(conn, "signals", filters={"priority": {"op": ">=", "value": 2}})
    assert {r["external_ref"] for r in hi} == {"m1", "m2"}
    inq = db.query(conn, "signals", filters={"external_ref": {"op": "in", "value": ["m0", "m2"]}})
    assert {r["external_ref"] for r in inq} == {"m0", "m2"}
    assert db.query(conn, "signals", limit=99999)  # must not raise; cap applies internally


def test_tools_query_passthrough(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="o", external_ref="m1", title="A")
    rows = mcp_tools.query(conn, "signals", filters={"external_ref": "m1"})
    assert rows[0]["title"] == "A"


def test_tools_search_finds_signal(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="o", external_ref="m1",
                     title="Quarterly budget review")
    hits = mcp_tools.search(conn, "budget")
    assert any(h["kind"] == "signal" and h["title"].startswith("Quarterly") for h in hits)


def test_tools_search_blank_returns_empty(tmp_path):
    conn = _conn(tmp_path)
    assert mcp_tools.search(conn, "   ") == []


def test_get_entity_full_context(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="o", external_ref="m1", title="A")
    db.tag_content(conn, "signal", 1, "urgent", "red")
    db.link_content(conn, "signal", 1, "topic", 1)
    ent = db.get_entity(conn, "signal", 1)
    assert ent["row"]["title"] == "A"
    assert [t["name"] for t in ent["tags"]] == ["urgent"]
    assert ent["links"][0]["target_type"] == "topic"
    assert ent["related_actions"] == []


def test_get_entity_missing_returns_none(tmp_path):
    conn = _conn(tmp_path)
    assert db.get_entity(conn, "signal", 999) is None


def test_get_entity_rejects_bad_type(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.get_entity(conn, "nope", 1)
