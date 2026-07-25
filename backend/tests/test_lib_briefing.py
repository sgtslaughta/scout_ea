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


from lib import briefing as _briefing


def _sig(i, impact, polarity=None, type_="proactive"):
    return {"id": i, "title": f"s{i}", "type": type_, "status": "new",
            "impact": impact, "polarity": polarity, "priority": 3}


def test_every_grid_caps_at_five():
    signals = [_sig(i, 90 - i, "risk") for i in range(10)]
    signals += [_sig(100 + i, 90 - i, "opportunity") for i in range(10)]
    people = [{"id": i, "name": f"p{i}", "importance": 1} for i in range(10)]
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=[], signals=signals,
        news=[], learning=[], topics=[], people=people, people_signals={}, summary=None,
    )
    assert len(out["risks"]) == 5
    assert len(out["opportunities"]) == 5
    assert len(out["people"]) == 5


def test_critical_caps_at_five():
    tasks = [{"id": i, "title": f"t{i}", "due_at": "2026-07-25T12:00:00Z", "priority": 1}
             for i in range(10)]
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=tasks, signals=[],
        news=[], learning=[], topics=[], people=[], people_signals={}, summary=None,
    )
    assert len(out["critical"]) == 5


def test_grids_are_sorted_by_score_descending():
    signals = [_sig(1, 30, "risk"), _sig(2, 95, "risk"), _sig(3, 60, "risk")]
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=[], signals=signals,
        news=[], learning=[], topics=[], people=[], people_signals={}, summary=None,
    )
    assert [r["score"] for r in out["risks"]] == [95, 60, 30]


def test_news_items_cap_at_five_per_topic():
    topics = [{"id": 1, "name": "AI", "priority": 1}]
    news = [{"id": i, "title": f"n{i}", "topic_id": 1, "status": "new",
             "relevance": (100 - i) / 100} for i in range(10)]
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=[], signals=[],
        news=news, learning=[], topics=topics, people=[], people_signals={}, summary=None,
    )
    assert len(out["news_by_topic"][0]["items"]) == 5


def test_score_reason_prefers_skill_authored_reasoning():
    row = {"impact": 91, "reasoning": "CEO asked for a decision before Friday's board call."}
    assert _briefing._score_reason(row) == "CEO asked for a decision before Friday's board call."


def test_score_reason_explains_explicit_impact():
    assert "91" in _briefing._score_reason({"impact": 91})


def test_score_reason_explains_relevance():
    out = _briefing._score_reason({"relevance": 0.82})
    assert "0.82" in out and "82" in out


def test_score_reason_explains_importance():
    # NOTE: importance is INVERTED relative to priority. `_score_of` computes
    # `_PRIORITY_SCORE[6 - importance]`, so importance 5 is the most important
    # person (-> 92) and importance 1 the least (-> 15). Verified against the
    # live function; do not "correct" these numbers to match priority's scale.
    out = _briefing._score_reason({"importance": 5})
    assert "5" in out and "92" in out

    low = _briefing._score_reason({"importance": 1})
    assert "1" in low and "15" in low


def test_score_reason_explains_priority():
    out = _briefing._score_reason({"priority": 2})
    assert "2" in out and "76" in out


def test_rank_attaches_score_reason():
    rows = [{"priority": 1, "title": "x"}]
    ranked = _briefing._rank(rows)
    assert ranked[0]["score_reason"]
    assert ranked[0]["score"] == 92
