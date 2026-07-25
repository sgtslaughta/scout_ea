"""Daily Briefing assembly — pure: takes fetched rows + now, returns the snapshot."""
from __future__ import annotations
from lib import deadlines as _deadlines

GRID_CAP = 5           # every briefing grid shows its top 5
PEOPLE_SIGNAL_CAP = 3

# priority (1=highest .. 5=lowest) -> 0-100 score, when no explicit impact is set
_PRIORITY_SCORE = {1: 92, 2: 76, 3: 55, 4: 34, 5: 15}


def _date(iso: str) -> str:
    return iso[:10]


def _score_of(row) -> int:
    """Unified 0-100 impact score. Prefer explicit `impact`, then `relevance`, then priority."""
    if row.get("impact") is not None:
        return max(0, min(100, int(row["impact"])))
    rel = row.get("relevance")
    if rel is not None:
        # relevance is a 1-5 ordinal where 1 = exact match, 5 = tangential
        # (see skills/news_search/SKILL.md); map through the same priority
        # table priority already uses, clamping out-of-range values to the
        # nearest valid end of the scale.
        return _PRIORITY_SCORE.get(max(1, min(5, round(rel))), 55)
    if row.get("importance") is not None:   # people: higher importance = more important
        return _PRIORITY_SCORE.get(6 - int(row["importance"]), 55)
    return _PRIORITY_SCORE.get(row.get("priority", 3), 55)


def _score_reason(row) -> str:
    """Plain-english explanation of this row's impact score.

    Branches mirror `_score_of` exactly and in the same order, so the sentence
    always describes the branch that actually produced the score. Signals may
    carry a skill-authored sentence in `reasoning`; everything else is derived
    from the inputs the formula read.
    """
    authored = (row.get("reasoning") or "").strip()
    if authored:
        return authored
    if row.get("impact") is not None:
        return f"Impact {_score_of(row)} set directly by the source skill."
    rel = row.get("relevance")
    if rel is not None:
        return f"Topic relevance {rel} (1=exact match, 5=tangential) → {_score_of(row)}."
    if row.get("importance") is not None:
        return f"Person importance {int(row['importance'])} of 5 → {_score_of(row)}."
    priority = row.get("priority", 3)
    if priority is None:
        priority = 3
    return f"Priority {int(priority)} → {_score_of(row)}."


def _rank(rows: list) -> list:
    """Attach 1-based rank + score + explanation to already-ordered rows (in place)."""
    for i, r in enumerate(rows, 1):
        r["rank"] = i
        r["score"] = _score_of(r)
        r["score_reason"] = _score_reason(r)
    return rows


def _critical(now, today, deadlines, tasks, signals):
    rows = []
    for d in deadlines:
        row = dict(d)
        row["kind"] = "deadline"
        row["countdown_seconds"] = _deadlines.countdown(d["due_at"], now)
        row["nav"] = {"view": "/tasks", "id": d["id"]}
        rows.append(row)

    tasks_today = (t for t in tasks if t.get("due_at") and _date(t["due_at"]) == today)
    rows += [{**t, "kind": "task", "nav": {"view": "/tasks", "id": t["id"]}}
             for t in tasks_today]

    hot = [s for s in signals
           if s.get("type") != "proactive"
           and s.get("status") == "new" and s.get("priority", 3) <= 1]
    rows += [{**s, "kind": "signal", "nav": {"view": "/feed", "id": s["id"]}}
             for s in hot]

    # rank by impact score desc; soonest countdown breaks ties (deadlines beat undated rows)
    rows.sort(key=lambda r: (-_score_of(r), r.get("countdown_seconds", 1 << 62)))
    return _rank(rows[:GRID_CAP])


def _news_by_topic(topics, news, learning):
    tmap = {t["id"]: t for t in topics}
    all_items = []
    for n in news:
        if n.get("status") in ("new", "suggested") and n.get("topic_id") in tmap:
            all_items.append({**n, "category": "news"})
    for l in learning:
        if l.get("status") in ("new", "suggested") and l.get("topic_id") in tmap:
            all_items.append({**l, "category": "learning"})

    # Cap the whole quadrant at GRID_CAP items TOTAL (consistent with the other
    # three quadrants), selected by score globally — not GRID_CAP per topic,
    # which used to blow the quadrant up to 5 x (number of topics) rows.
    all_items.sort(key=_score_of, reverse=True)
    top = _rank(all_items[:GRID_CAP])   # global 1..5 ranks: items are grouped under
                                         # topic headings, not re-ranked per group, so
                                         # a reader sees one consistent 1-5 ordering
                                         # for "today's top news" across all topics.

    by_topic = {}
    for item in top:
        by_topic.setdefault(item["topic_id"], []).append(item)

    groups = []
    for tid, items in by_topic.items():
        groups.append({"topic_id": tid, "topic_name": tmap[tid]["name"],
                       "topic_priority": tmap[tid].get("priority", 3),
                       "items": items})
    groups.sort(key=lambda g: g["topic_priority"])
    return groups


def assemble(now, deadlines, tasks, signals, news, learning, topics, people,
             people_signals, summary):
    today = _date(now)
    proactive = [s for s in signals if s.get("type") == "proactive"
                 and s.get("status") == "new"]
    risks = sorted((dict(s) for s in proactive if s.get("polarity") == "risk"),
                   key=_score_of, reverse=True)
    opps = sorted((dict(s) for s in proactive if s.get("polarity") == "opportunity"),
                  key=_score_of, reverse=True)
    people_out = []
    for p in sorted(people, key=lambda p: p.get("importance", 0), reverse=True):
        sigs = (people_signals.get(p["id"]) or [])[:PEOPLE_SIGNAL_CAP]
        people_out.append({**p, "signals": sigs})
    return {
        "date": today,
        "summary": summary,
        "critical": _critical(now, today, deadlines, tasks, signals),
        "risks": _rank(risks[:GRID_CAP]),
        "opportunities": _rank(opps[:GRID_CAP]),
        "news_by_topic": _news_by_topic(topics, news, learning),
        "people": _rank(people_out[:GRID_CAP]),
        "weather": None,   # SP2
        "finance": None,   # SP3
    }
