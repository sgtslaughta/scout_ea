import pytest
from ea import db

def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)

def test_upsert_dedups_on_external_ref(tmp_path):
    conn = _conn(tmp_path)
    f = dict(type="email", source="outlook", external_ref="msg-1", title="Hi")
    assert db.upsert_signal(conn, **f) == 1          # inserted
    assert db.upsert_signal(conn, **f) == 0          # deduped, no second row
    assert conn.execute("SELECT COUNT(*) FROM signals").fetchone()[0] == 1

def test_list_signals_filters_by_status(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_signal(conn, type="email", source="outlook", external_ref="a", title="A")
    db.upsert_signal(conn, type="teams", source="teams", external_ref="b", title="B")
    db.update_status(conn, "signals", 1, "dismissed")
    new_rows = db.list_signals(conn, status="new")
    assert [r["external_ref"] for r in new_rows] == ["b"]

def test_update_status_rejects_unknown_table(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        db.update_status(conn, "robert'); DROP TABLE signals;--", 1, "done")

def test_data_version_bumps_on_external_write(tmp_path):
    # data_version only changes for OTHER connections' commits -> use two conns
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    reader = db.get_conn(p)
    writer = db.get_conn(p)
    before = db.data_version(reader)
    db.upsert_signal(writer, type="email", source="outlook", external_ref="x", title="X")
    after = db.data_version(reader)
    assert after != before

def test_upsert_signal_requires_external_ref(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="external_ref"):
        db.upsert_signal(conn, type="email", source="outlook", title="No ref")
