import pytest
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_upsert_record_inserts_new(tmp_path):
    conn = _conn(tmp_path)
    rid = db.upsert_record(conn, kind="qtr_event", external_ref="q1",
                           data={"title": "Q3 Kickoff"})
    assert rid > 0
    rows = db.list_records(conn, "qtr_event")
    assert len(rows) == 1
    assert rows[0]["data"] == {"title": "Q3 Kickoff"}


def test_upsert_record_dedups_on_external_ref(tmp_path):
    conn = _conn(tmp_path)
    rid1 = db.upsert_record(conn, kind="qtr_event", external_ref="q1", data={"a": 1})
    rid2 = db.upsert_record(conn, kind="qtr_event", external_ref="q1", data={"a": 2})
    assert rid1 == rid2
    rows = db.list_records(conn, "qtr_event")
    assert len(rows) == 1
    assert rows[0]["data"] == {"a": 2}


def test_json_round_trips_nested_and_unicode(tmp_path):
    conn = _conn(tmp_path)
    data = {"nested": {"a": [1, 2, 3]}, "name": "Café ünïcödé ☃"}
    db.upsert_record(conn, kind="ebc", external_ref="e1", data=data)
    rows = db.list_records(conn, "ebc")
    assert rows[0]["data"] == data


def test_list_records_filters_by_kind(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_record(conn, kind="territory", external_ref="t1", data={})
    db.upsert_record(conn, kind="pipeline", external_ref="p1", data={})
    assert len(db.list_records(conn, "territory")) == 1
    assert len(db.list_records(conn, "pipeline")) == 1


def test_list_records_filters_by_status(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_record(conn, kind="revops", external_ref="r1", data={}, status="active")
    db.upsert_record(conn, kind="revops", external_ref="r2", data={}, status="archived")
    assert len(db.list_records(conn, "revops", status="active")) == 1
    assert len(db.list_records(conn, "revops", status="archived")) == 1
    assert len(db.list_records(conn, "revops")) == 2


def test_list_records_orders_by_sort_then_id(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_record(conn, kind="ou_feedback", external_ref="o1", data={}, sort=2)
    db.upsert_record(conn, kind="ou_feedback", external_ref="o2", data={}, sort=1)
    db.upsert_record(conn, kind="ou_feedback", external_ref="o3", data={}, sort=1)
    rows = db.list_records(conn, "ou_feedback")
    assert [r["external_ref"] for r in rows] == ["o2", "o3", "o1"]


def test_list_records_unknown_kind_returns_empty(tmp_path):
    conn = _conn(tmp_path)
    assert db.list_records(conn, "nope") == []


def test_set_config_quick_links_no_longer_raises(tmp_path):
    conn = _conn(tmp_path)
    db.set_config(conn, "quick_links", "[]")
    row = conn.execute("SELECT value FROM config WHERE key='quick_links'").fetchone()
    assert row["value"] == "[]"


def test_tasks_has_sort_column(tmp_path):
    conn = _conn(tmp_path)
    pragma = conn.execute("PRAGMA table_info(tasks)").fetchall()
    cols = {r[1]: r for r in pragma}
    assert "sort" in cols
    tid = db.add_task(conn, title="t")
    row = conn.execute("SELECT sort FROM tasks WHERE id=?", (tid,)).fetchone()
    assert row["sort"] == 0
