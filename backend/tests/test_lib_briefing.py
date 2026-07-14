# backend/tests/test_lib_briefing.py
from lib import briefing

NOW = "2026-06-21T09:00:00+00:00"


def _base(**kw):
    args = dict(now=NOW, deadlines=[], tasks=[], signals=[], news=[], learning=[],
                topics=[], people=[], people_signals={}, summary=None)
    args.update(kw)
    return briefing.assemble(**args)


def test_shape_and_empty_safe():
    out = _base()
    assert out["date"] == "2026-06-21"
    assert out["summary"] is None
    for k in ("critical", "risks", "opportunities", "news_by_topic", "people"):
        assert out[k] == []
    assert out["weather"] is None and out["finance"] is None


def test_critical_ordered_by_score_then_urgency():
    out = _base(
        deadlines=[{"id": 5, "title": "D", "due_at": "2026-06-21T17:00:00+00:00", "priority": 1}],  # 92
        tasks=[{"id": 7, "title": "T", "due_at": "2026-06-21T12:00:00+00:00", "priority": 3}],       # 55
        signals=[{"id": 9, "title": "S", "type": "email", "priority": 1, "status": "new", "impact": 80}],  # 80
    )
    assert [c["id"] for c in out["critical"]] == [5, 9, 7]        # by score desc: 92, 80, 55
    assert [c["rank"] for c in out["critical"]] == [1, 2, 3]
    assert [c["score"] for c in out["critical"]] == [92, 80, 55]
    assert out["critical"][0]["kind"] == "deadline"
    assert out["critical"][0]["nav"] == {"view": "/tasks", "id": 5}
    assert out["critical"][0]["countdown_seconds"] == 8 * 3600


def test_only_today_tasks_and_lowpri_signals_excluded():
    out = _base(
        tasks=[{"id": 1, "title": "tmrw", "due_at": "2026-06-22T12:00:00+00:00", "priority": 1}],
        signals=[{"id": 2, "title": "low", "type": "email", "priority": 3, "status": "new"}],
    )
    assert out["critical"] == []


def test_impact_score_and_rank_sorts_desc():
    out = _base(signals=[
        {"id": 1, "title": "a", "type": "proactive", "status": "new", "polarity": "risk", "impact": 40},
        {"id": 2, "title": "b", "type": "proactive", "status": "new", "polarity": "risk", "impact": 88},
    ])
    assert [r["id"] for r in out["risks"]] == [2, 1]      # by impact desc
    assert [r["rank"] for r in out["risks"]] == [1, 2]
    assert [r["score"] for r in out["risks"]] == [88, 40]


def test_score_falls_back_to_priority_then_relevance():
    out = _base(
        deadlines=[{"id": 5, "title": "D", "due_at": "2026-06-21T17:00:00+00:00", "priority": 1}],
        topics=[{"id": 10, "name": "AI", "priority": 1}],
        news=[{"id": 1, "title": "a", "topic_id": 10, "relevance": 0.9, "status": "new"}],
    )
    assert out["critical"][0]["score"] == 92 and out["critical"][0]["rank"] == 1  # priority 1
    assert out["news_by_topic"][0]["items"][0]["score"] == 90                     # relevance 0.9 -> 90


def test_polarity_split():
    out = _base(signals=[
        {"id": 1, "title": "r", "type": "proactive", "status": "new", "polarity": "risk"},
        {"id": 2, "title": "o", "type": "proactive", "status": "new", "polarity": "opportunity"},
        {"id": 3, "title": "n", "type": "proactive", "status": "new", "polarity": None},
    ])
    assert [r["id"] for r in out["risks"]] == [1]
    assert [o["id"] for o in out["opportunities"]] == [2]


def test_news_grouped_by_topic_relevance_desc():
    out = _base(
        topics=[{"id": 10, "name": "AI", "priority": 1}],
        news=[{"id": 1, "title": "a", "topic_id": 10, "relevance": 0.2, "status": "new"},
              {"id": 2, "title": "b", "topic_id": 10, "relevance": 0.9, "status": "new"}],
        learning=[{"id": 3, "title": "c", "topic_id": 10, "relevance": 0.5, "status": "suggested"}],
    )
    grp = out["news_by_topic"][0]
    assert grp["topic_id"] == 10 and grp["topic_name"] == "AI"
    assert [i["id"] for i in grp["items"]] == [2, 3, 1]
    assert grp["items"][0]["category"] == "news"
    assert grp["items"][1]["category"] == "learning"


def test_people_ordered_by_importance_with_signals():
    out = _base(
        people=[{"id": 1, "name": "Lo", "importance": 1},
                {"id": 2, "name": "Hi", "importance": 5}],
        people_signals={2: [{"id": 8, "title": "s"}]},
    )
    assert [p["id"] for p in out["people"]] == [2, 1]
    assert out["people"][0]["signals"][0]["id"] == 8
    assert out["people"][1]["signals"] == []
