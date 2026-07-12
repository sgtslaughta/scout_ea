"""Background thread: generate due-item reminders, then push new critical + warning alerts."""
from __future__ import annotations
import threading
import time
from ea import db
from lib import push


def start_push_worker(db_path, interval=30):
    """Start a daemon thread that generates due reminders and pushes pending
    critical + warning alerts every `interval` seconds."""
    def loop():
        while True:
            try:
                conn = db.get_conn(db_path)
                try:
                    push.generate_due_reminders(conn)
                    push.push_pending_alerts(conn)
                finally:
                    conn.close()
            except Exception:
                pass  # ponytail: never let the worker crash the process; retry next tick
            time.sleep(interval)
    t = threading.Thread(target=loop, daemon=True, name="push-worker")
    t.start()
    return t
