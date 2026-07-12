"""Loud alerting — repeat-until-ack push + config for urgent alerts."""
from ea import db


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
