"""Daily Outlook assembly — pure: takes fetched rows + now, returns the snapshot."""
from __future__ import annotations
from lib import deadlines as _deadlines


def _date(iso: str) -> str:
    return iso[:10]  # YYYY-MM-DD prefix of an ISO-8601 string


def assemble(now, deadlines, trends, proactive, tasks):
    today = _date(now)
    dl = []
    for d in deadlines:
        row = dict(d)
        row["countdown_seconds"] = _deadlines.countdown(d["due_at"], now)
        dl.append(row)
    tasks_today = [dict(t) for t in tasks if t.get("due_at") and _date(t["due_at"]) == today]
    return {
        "date": today,
        "deadlines": dl,
        "top_trends": [dict(t) for t in trends[:5]],
        "proactive": [dict(p) for p in proactive],
        "tasks_due_today": tasks_today,
    }
