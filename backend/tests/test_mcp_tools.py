import pytest
from ea import db
from mcp_server import tools


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_add_and_list_signal(tmp_path):
    conn = _conn(tmp_path)
    assert tools.add_signal(conn, type="email", source="outlook",
                            external_ref="m1", title="Hi", status="new") == 1
    rows = tools.list_table(conn, "signals", status="new")
    assert [r["external_ref"] for r in rows] == ["m1"]


def test_list_table_rejects_unknown(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        tools.list_table(conn, "sqlite_master")


def test_update_status_and_helpers(tmp_path):
    conn = _conn(tmp_path)
    tools.add_signal(conn, type="email", source="outlook", external_ref="m1", title="Hi")
    assert tools.update_status(conn, "signals", 1, "dismissed") == 1
    tid = tools.add_task(conn, title="do it")
    assert tid >= 1
    did = tools.add_deadline(conn, title="D", due_at="2099-01-01T00:00:00+00:00",
                             source="manual", external_ref="manual:x")
    assert did == 1
    assert tools.log_skill_run(conn, "triage_email", items_created=1) >= 1


def test_trend_tools(tmp_path):
    conn = _conn(tmp_path)
    rid = tools.upsert_trend(conn, "ai", "topic", "2026-06-14", "2026-06-21", score=2.0)
    assert rid >= 1
    assert tools.add_trend_finding(conn, title="P", url="http://x",
                                   external_ref="http://x", source="web") == 1
