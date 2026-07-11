"""Derive a skill's expected run cadence from its freeform `schedule` string and
decide whether it is currently "active" (running on schedule).

Schedules are human text, not cron, e.g.:
  "heartbeat 30m, workdays 07:00-18:00 EST"  -> every 30 min
  "automation, daily 08:00 EST"              -> daily
  "automation, weekly Friday 10:00 EST"      -> weekly

A skill is active if its last run is within a grace window (2x the expected
interval) of now — cadence-relative, so a weekly skill idle 3 days is healthy
while a 30m skill idle 3 days is not. Pure: no DB, no clock unless passed one.
"""
from __future__ import annotations
import re
from datetime import datetime, timezone

# Fallback grace when the cadence can't be parsed: treat as "should run daily".
_FALLBACK_GRACE_SECONDS = 24 * 3600
_GRACE_FACTOR = 2

_UNIT_SECONDS = {"m": 60, "h": 3600, "d": 86400}
# A number immediately followed by a time unit, e.g. "30m", "6 h", "2d".
_INTERVAL_RE = re.compile(r"(\d+)\s*(m|min|mins|minutes|h|hr|hrs|hours|d|day|days)\b")


def expected_interval_seconds(schedule: str | None) -> int | None:
    """Expected seconds between runs, or None if the cadence is unrecognizable."""
    if not schedule:
        return None
    s = schedule.lower()
    m = _INTERVAL_RE.search(s)
    if m:
        return int(m.group(1)) * _UNIT_SECONDS[m.group(2)[0]]
    if "hourly" in s:
        return 3600
    if "daily" in s:
        return 86400
    if "weekly" in s:
        return 604800
    if "monthly" in s:
        return 2592000
    return None


def _parse_iso(iso: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def is_active(schedule: str | None, last_run_iso: str | None,
              now: datetime | None = None) -> bool:
    """True if the skill ran recently enough for its cadence (2x grace)."""
    if not last_run_iso:
        return False
    last = _parse_iso(last_run_iso)
    if last is None:
        return False
    now = now or datetime.now(timezone.utc)
    interval = expected_interval_seconds(schedule)
    grace = interval * _GRACE_FACTOR if interval else _FALLBACK_GRACE_SECONDS
    return (now - last).total_seconds() <= grace


# ponytail: runnable self-check — `python -m lib.skill_health`.
if __name__ == "__main__":
    assert expected_interval_seconds("heartbeat 30m, workdays 07:00-18:00 EST") == 1800
    assert expected_interval_seconds("automation, daily 08:00 EST") == 86400
    assert expected_interval_seconds("automation, weekly Friday 10:00 EST") == 604800
    assert expected_interval_seconds("") is None
    now = datetime(2026, 7, 12, 12, 0, tzinfo=timezone.utc)
    # 30m skill, ran 20 min ago -> active; ran 3h ago -> not
    assert is_active("heartbeat 30m", "2026-07-12T11:40:00Z", now) is True
    assert is_active("heartbeat 30m", "2026-07-12T09:00:00Z", now) is False
    # weekly skill, ran 3 days ago -> still active
    assert is_active("weekly Friday 10:00", "2026-07-09T10:00:00Z", now) is True
    assert is_active("daily", None, now) is False
    print("skill_health self-check OK")
