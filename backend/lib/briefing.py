"""Daily Briefing assembly — pure: takes fetched rows + now, returns the snapshot."""
from __future__ import annotations
from lib import deadlines as _deadlines

CRITICAL_CAP = 8
PEOPLE_SIGNAL_CAP = 3


def _date(iso: str) -> str:
    return iso[:10]


def _critical(now, today, deadlines, tasks, signals):
    items = []
    for d in deadlines:
        row = dict(d)
        row["kind"] = "deadline"
        row["countdown_seconds"] = _deadlines.countdown(d["due_at"], now)
        row["nav"] = {"view": "/tasks", "id": d["id"]}
        items.append(row)
    items.sort(key=lambda r: r["countdown_seconds"])

    tasks_today = sorted(
        (t for t in tasks if t.get("due_at") and _date(t["due_at"]) == today),
        key=lambda t: t.get("priority", 3),
    )
    task_rows = [{**t, "kind": "task", "nav": {"view": "/tasks", "id": t["id"]}}
                 for t in tasks_today]

    hot = [s for s in signals
           if s.get("type") != "proactive"
           and s.get("status") == "new" and s.get("priority", 3) <= 1]
    sig_rows = [{**s, "kind": "signal", "nav": {"view": "/feed", "id": s["id"]}}
                for s in hot]

    return (items + task_rows + sig_rows)[:CRITICAL_CAP]


def _news_by_topic(topics, news, learning):
    by_topic = {}
    for n in news:
        if n.get("status") in ("new", "suggested"):
            by_topic.setdefault(n.get("topic_id"), []).append({**n, "category": "news"})
    for l in learning:
        if l.get("status") in ("new", "suggested"):
            by_topic.setdefault(l.get("topic_id"), []).append({**l, "category": "learning"})

    tmap = {t["id"]: t for t in topics}
    groups = []
    for tid, items in by_topic.items():
        if tid not in tmap:
            continue
        items.sort(key=lambda i: i.get("relevance") or 0, reverse=True)
        groups.append({"topic_id": tid, "topic_name": tmap[tid]["name"],
                       "topic_priority": tmap[tid].get("priority", 3), "items": items})
    groups.sort(key=lambda g: g["topic_priority"])
    return groups


def assemble(now, deadlines, tasks, signals, news, learning, topics, people,
             people_signals, summary):
    today = _date(now)
    proactive = [s for s in signals if s.get("type") == "proactive"
                 and s.get("status") == "new"]
    people_out = []
    for p in sorted(people, key=lambda p: p.get("importance", 0), reverse=True):
        sigs = (people_signals.get(p["id"]) or [])[:PEOPLE_SIGNAL_CAP]
        people_out.append({**p, "signals": sigs})
    return {
        "date": today,
        "summary": summary,
        "critical": _critical(now, today, deadlines, tasks, signals),
        "risks": [dict(s) for s in proactive if s.get("polarity") == "risk"],
        "opportunities": [dict(s) for s in proactive if s.get("polarity") == "opportunity"],
        "news_by_topic": _news_by_topic(topics, news, learning),
        "people": people_out,
        "weather": None,   # SP2
        "finance": None,   # SP3
    }
