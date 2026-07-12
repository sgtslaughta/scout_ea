"""Timeline reminder generation — inserts deduped 'warning' alerts for items due within lead window."""
from ea import db
from lib import push


def _conn(tmp_path):
    # Clean slate so seed rows don't perturb count assertions.
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    for t in ("alerts", "critical_deadlines", "tasks", "events", "news_items"):
        conn.execute(f"DELETE FROM {t}")
    conn.commit()
    return conn


def test_deadline_in_window_creates_one_alert(tmp_path):
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
        "VALUES ('Board memo', datetime('now','+10 minutes'), 'test', 'active', 1)")
    conn.commit()

    n = push.generate_due_reminders(conn)
    assert n == 1
    row = conn.execute(
        "SELECT severity, source_table, source_id FROM alerts").fetchone()
    assert row["severity"] == "warning"
    assert row["source_table"] == "deadline"
    assert row["source_id"] == 1


def test_reminder_is_deduped_on_second_run(tmp_path):
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
        "VALUES ('Board memo', datetime('now','+10 minutes'), 'test', 'active', 1)")
    conn.commit()
    assert push.generate_due_reminders(conn) == 1
    assert push.generate_due_reminders(conn) == 0
    assert conn.execute("SELECT COUNT(*) c FROM alerts").fetchone()["c"] == 1


def test_item_outside_window_no_alert(tmp_path):
    conn = _conn(tmp_path)
    conn.execute(
        "INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
        "VALUES ('Far off', datetime('now','+2 hours'), 'test', 'active', 1)")
    conn.commit()
    assert push.generate_due_reminders(conn) == 0


def test_disabled_flag_suppresses(tmp_path):
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO config(key,value) VALUES('reminder_enabled','0') "
                 "ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    conn.execute(
        "INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
        "VALUES ('Board memo', datetime('now','+10 minutes'), 'test', 'active', 1)")
    conn.commit()
    assert push.generate_due_reminders(conn) == 0


def test_all_four_sources_fire(tmp_path):
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO critical_deadlines (title, due_at, source, status, visible) "
                 "VALUES ('D', datetime('now','+5 minutes'), 't', 'active', 1)")
    conn.execute("INSERT INTO tasks (title, due_at, status) "
                 "VALUES ('T', datetime('now','+5 minutes'), 'open')")
    conn.execute("INSERT INTO events (title, chosen_time, status) "
                 "VALUES ('E', datetime('now','+5 minutes'), 'scheduled')")
    conn.execute("INSERT INTO news_items (title, event_at, status) "
                 "VALUES ('N', datetime('now','+5 minutes'), 'new')")
    conn.commit()
    assert push.generate_due_reminders(conn) == 4
    tags = {r["source_table"] for r in conn.execute("SELECT source_table FROM alerts")}
    assert tags == {"deadline", "task", "event", "news"}


def test_pending_alerts_sends_warning(tmp_path, monkeypatch):
    import pywebpush
    calls = []
    monkeypatch.setattr(pywebpush, "webpush", lambda **kw: calls.append(kw))
    conn = _conn(tmp_path)
    db.add_subscription(conn, "https://push.example.com/1", "p", "a")
    conn.execute("INSERT INTO alerts (severity,title,body,status) "
                 "VALUES ('warning','Due soon: X','...','unread')")
    conn.commit()
    assert push.push_pending_alerts(conn) == 1
    assert len(calls) == 1
