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
