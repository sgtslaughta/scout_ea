import sqlite3
from ea import db

def _mem():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE config(key TEXT PRIMARY KEY, value TEXT)")
    return conn

def test_wizard_keys_writable():
    conn = _mem()
    for k in ("mcp_name", "wizard_done", "mcp_last_seen"):
        db.set_config(conn, k, "x")
        row = conn.execute("SELECT value FROM config WHERE key=?", (k,)).fetchone()
        assert row["value"] == "x"

def test_unknown_key_still_rejected():
    conn = _mem()
    try:
        db.set_config(conn, "not_a_key", "x")
        assert False, "expected ValueError"
    except ValueError:
        pass
