"""Deadline date normalization + countdown. Pure: no DB/LLM."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday",
             "friday", "saturday", "sunday"]


def _parse(ts: str) -> datetime:
    d = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _eod(d: datetime) -> str:
    d = d.replace(hour=17, minute=0, second=0, microsecond=0)
    return d.astimezone(timezone.utc).isoformat()


def normalize_due(expr, now):
    """Map a deadline expression to a UTC ISO-8601 string, or None."""
    now_dt = _parse(now)
    # 1) explicit ISO datetime/date
    try:
        d = datetime.fromisoformat(expr.strip().replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(timezone.utc).isoformat()
    except ValueError:
        pass
    # 2) keywords
    s = expr.strip().lower()
    s = s[3:].strip() if s.startswith("eod") else s   # strip leading 'eod'
    if s in ("", "today"):
        return _eod(now_dt)
    if s == "tomorrow":
        return _eod(now_dt + timedelta(days=1))
    if s in _WEEKDAYS:
        ahead = (_WEEKDAYS.index(s) - now_dt.weekday()) % 7 or 7  # next future occurrence
        return _eod(now_dt + timedelta(days=ahead))
    return None


def countdown(due_at, now) -> int:
    """Whole seconds until due_at (negative if past)."""
    return int((_parse(due_at) - _parse(now)).total_seconds())
