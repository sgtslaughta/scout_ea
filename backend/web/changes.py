"""DB change detection for SSE — each stream owns one connection it polls.

data_version is connection-local (not comparable across connections), so the
caller passes the same conn to current_version and every wait_for_change.
"""
from __future__ import annotations
import time
from ea import db


def current_version(conn) -> int:
    """Read PRAGMA data_version on the given connection."""
    return db.data_version(conn)


def wait_for_change(conn, last_version, timeout=25, poll=0.2) -> int:
    """Poll `conn` until data_version != last_version (return new) or timeout (return last)."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        v = db.data_version(conn)
        if v != last_version:
            return v
        time.sleep(poll)
    return last_version
