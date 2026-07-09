"""get_conn connections must be usable from a different thread (FastAPI threadpool)."""
import threading

from ea import db


def test_conn_usable_across_threads(tmp_path):
    conn = db.get_conn(tmp_path / "t.sqlite")
    result = {}

    def use():
        result["ok"] = conn.execute("SELECT 1").fetchone()[0]

    t = threading.Thread(target=use)
    t.start()
    t.join()
    conn.close()
    assert result.get("ok") == 1
