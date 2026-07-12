"""Loud alerting — repeat-until-ack push + config for urgent alerts."""
import json
from ea import db
from lib import push


def test_migrate_adds_repeat_count(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    # Simulate a pre-existing DB that predates the column.
    conn.execute("ALTER TABLE alerts DROP COLUMN repeat_count")
    conn.commit()
    assert not any(r[1] == "repeat_count" for r in conn.execute("PRAGMA table_info(alerts)"))
    db._migrate(conn)
    assert any(r[1] == "repeat_count" for r in conn.execute("PRAGMA table_info(alerts)"))


def test_config_keys_writable(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    db.set_config(conn, "alert_loud_threshold", "warning")
    db.set_config(conn, "alert_sound_enabled", "0")
    rows = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM config")}
    assert rows["alert_loud_threshold"] == "warning"
    assert rows["alert_sound_enabled"] == "0"


def _conn(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    conn.execute("DELETE FROM alerts")
    db.add_subscription(conn, "https://push.example.com/1", "p", "a")
    conn.commit()
    return conn


def _record_webpush(monkeypatch):
    import pywebpush
    calls = []
    monkeypatch.setattr(pywebpush, "webpush", lambda **kw: calls.append(kw))
    return calls


def test_loud_severities_mapping(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    assert push._loud_severities(conn) == {"critical"}          # default
    db.set_config(conn, "alert_loud_threshold", "warning")
    assert push._loud_severities(conn) == {"warning", "critical"}
    db.set_config(conn, "alert_loud_threshold", "off")
    assert push._loud_severities(conn) == set()


def test_initial_push_marks_loud_payload(tmp_path, monkeypatch):
    calls = _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO alerts (severity,title,body,status) VALUES ('critical','C','x','unread')")
    conn.execute("INSERT INTO alerts (severity,title,body,status) VALUES ('warning','W','y','unread')")
    conn.commit()
    push.push_pending_alerts(conn)                              # threshold default = critical
    payloads = [json.loads(c["data"]) for c in calls]
    by_title = {p["title"]: p for p in payloads}
    assert by_title["C"]["loud"] is True
    assert by_title["C"]["tag"].startswith("alert-")
    assert by_title["W"]["loud"] is False


def test_repush_resends_after_interval(tmp_path, monkeypatch):
    calls = _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    # critical, already initially pushed, unread, updated_at 6 min ago
    conn.execute(
        "INSERT INTO alerts (severity,title,body,status,notified_push,repeat_count,updated_at) "
        "VALUES ('critical','C','x','unread',1,0,datetime('now','-6 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 1
    assert len(calls) == 1
    assert conn.execute("SELECT repeat_count FROM alerts").fetchone()["repeat_count"] == 1


def test_repush_waits_for_interval(tmp_path, monkeypatch):
    _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO alerts (severity,title,body,status,notified_push,repeat_count,updated_at) "
        "VALUES ('critical','C','x','unread',1,0,datetime('now','-1 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 0                   # only 1 min elapsed


def test_repush_stops_at_cap(tmp_path, monkeypatch):
    _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO alerts (severity,title,body,status,notified_push,repeat_count,updated_at) "
        "VALUES ('critical','C','x','unread',1,2,datetime('now','-30 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 0                   # repeat_count already at cap


def test_repush_excludes_acked_and_below_threshold(tmp_path, monkeypatch):
    _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO alerts (severity,title,status,notified_push,repeat_count,updated_at) "
                 "VALUES ('critical','acked','read',1,0,datetime('now','-6 minutes'))")
    conn.execute("INSERT INTO alerts (severity,title,status,notified_push,repeat_count,updated_at) "
                 "VALUES ('warning','low','unread',1,0,datetime('now','-6 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 0                   # acked skipped; warning below default threshold


def test_repush_off_threshold(tmp_path, monkeypatch):
    _record_webpush(monkeypatch)
    conn = _conn(tmp_path)
    db.set_config(conn, "alert_loud_threshold", "off")
    conn.execute("INSERT INTO alerts (severity,title,status,notified_push,repeat_count,updated_at) "
                 "VALUES ('critical','C','unread',1,0,datetime('now','-6 minutes'))")
    conn.commit()
    assert push.repush_loud_alerts(conn) == 0
