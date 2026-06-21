"""DB change detection for SSE — polls PRAGMA data_version on a persistent connection."""
from __future__ import annotations
import time
from ea import db

# Keep one long-lived connection per db_path for polling
_polling_conns = {}


def current_version(db_path) -> int:
    """Get current data_version and establish a polling connection if needed."""
    # Ensure a persistent polling connection exists for this db_path
    db_key = str(db_path)
    if db_key not in _polling_conns:
        _polling_conns[db_key] = db.get_conn(db_path)
    polling_conn = _polling_conns[db_key]
    return db.data_version(polling_conn)


def wait_for_change(db_path, last_version, timeout=25, poll=0.2) -> int:
    """Block until data_version != last_version (return new) or timeout (return last)."""
    # Use the persistent polling connection
    db_key = str(db_path)
    if db_key not in _polling_conns:
        _polling_conns[db_key] = db.get_conn(db_path)
    polling_conn = _polling_conns[db_key]

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        v = db.data_version(polling_conn)
        if v != last_version:
            return v
        time.sleep(poll)
    return last_version
