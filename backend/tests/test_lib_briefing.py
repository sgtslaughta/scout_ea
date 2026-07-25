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
        news=[{"id": 1, "title": "a", "topic_id": 10, "relevance": 1, "status": "new"}],
    )
    assert out["critical"][0]["score"] == 92 and out["critical"][0]["rank"] == 1  # priority 1
    assert out["news_by_topic"][0]["items"][0]["score"] == 92                     # relevance 1 (exact) -> 92


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
        news=[{"id": 1, "title": "a", "topic_id": 10, "relevance": 3, "status": "new"},
              {"id": 2, "title": "b", "topic_id": 10, "relevance": 1, "status": "new"}],
        learning=[{"id": 3, "title": "c", "topic_id": 10, "relevance": 2, "status": "suggested"}],
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


def test_news_quadrant_caps_at_five_total_single_topic():
    topics = [{"id": 1, "name": "AI", "priority": 1}]
    news = [{"id": i, "title": f"n{i}", "topic_id": 1, "status": "new",
             "relevance": (i % 5) + 1} for i in range(10)]
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=[], signals=[],
        news=news, learning=[], topics=topics, people=[], people_signals={}, summary=None,
    )
    assert len(out["news_by_topic"][0]["items"]) == 5


def test_news_quadrant_caps_at_five_total_across_multiple_topics():
    """The bug: capping per-topic instead of per-quadrant produced 5 x N rows.
    Two topics, each with 10 candidate items -> the quadrant must still show 5
    items TOTAL (globally top-scored), grouped under whichever topics they
    belong to; a topic contributing no surviving item must not appear at all."""
    topics = [{"id": 1, "name": "AI", "priority": 1}, {"id": 2, "name": "Markets", "priority": 2}]
    news = (
        # relevance 1 = exact match (most relevant, highest score)
        [{"id": i, "title": f"ai{i}", "topic_id": 1, "status": "new",
          "relevance": 1} for i in range(10)]
        # relevance 5 = tangential (least relevant, lowest score) -- and, under
        # the OLD inverted sort (raw relevance desc), 5 would have won, proving
        # this test fails against the pre-fix sort.
        + [{"id": 100 + i, "title": f"mk{i}", "topic_id": 2, "status": "new",
            "relevance": 5} for i in range(10)]
    )
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=[], signals=[],
        news=news, learning=[], topics=topics, people=[], people_signals={}, summary=None,
    )
    total = sum(len(g["items"]) for g in out["news_by_topic"])
    assert total == 5
    # All 5 highest-relevance (lowest relevance NUMBER) candidates come from
    # topic AI -> Markets group should be absent entirely.
    assert [g["topic_id"] for g in out["news_by_topic"]] == [1]
    assert [i["id"] for i in out["news_by_topic"][0]["items"]] == [0, 1, 2, 3, 4]
    # Ranks are global across the quadrant (1..5), not restarted per topic group.
    assert [i["rank"] for i in out["news_by_topic"][0]["items"]] == [1, 2, 3, 4, 5]


def test_score_reason_prefers_skill_authored_reasoning():
    row = {"impact": 91, "reasoning": "CEO asked for a decision before Friday's board call."}
    assert _briefing._score_reason(row) == "CEO asked for a decision before Friday's board call."


def test_score_reason_explains_explicit_impact():
    assert "91" in _briefing._score_reason({"impact": 91})


def test_score_reason_explains_relevance():
    out = _briefing._score_reason({"relevance": 2})
    assert "2" in out and "76" in out


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


def test_score_reason_handles_null_priority_like_score_of():
    row = {"priority": None}
    assert _briefing._score_of(row) == 55
    out = _briefing._score_reason(row)          # must not raise
    assert "55" in out


def test_score_reason_falls_through_null_impact_to_priority():
    out = _briefing._score_reason({"impact": None, "priority": 2})
    assert "2" in out and "76" in out


def test_score_reason_falls_through_null_relevance_to_priority():
    out = _briefing._score_reason({"relevance": None, "priority": 2})
    assert "2" in out and "76" in out


def test_score_reason_falls_through_null_importance_to_priority():
    out = _briefing._score_reason({"importance": None, "priority": 2})
    assert "2" in out and "76" in out


def test_score_reason_number_always_matches_score_of():
    rows = [
        {"impact": 91},
        {"relevance": 4},
        {"importance": 3},
        {"priority": 4},
        {"priority": None},
        {"impact": None, "priority": 1},
        {"relevance": None, "importance": None, "priority": 5},
        {},
    ]
    for row in rows:
        expected = _briefing._score_of(row)
        assert str(expected) in _briefing._score_reason(row)


def test_assemble_grids_all_carry_nonempty_score_reason():
    out = _briefing.assemble(
        now=NOW,
        deadlines=[{"id": 5, "title": "D", "due_at": "2026-06-21T17:00:00+00:00", "priority": 1}],
        tasks=[{"id": 7, "title": "T", "due_at": "2026-06-21T12:00:00+00:00", "priority": None}],
        signals=[
            {"id": 9, "title": "S", "type": "email", "priority": 1, "status": "new", "impact": 80},
            {"id": 1, "title": "r", "type": "proactive", "status": "new", "polarity": "risk"},
            {"id": 2, "title": "o", "type": "proactive", "status": "new", "polarity": "opportunity"},
        ],
        news=[{"id": 1, "title": "a", "topic_id": 10, "relevance": 4, "status": "new"}],
        learning=[],
        topics=[{"id": 10, "name": "AI", "priority": 1}],
        people=[{"id": 2, "name": "Hi", "importance": 5}],
        people_signals={},
        summary=None,
    )
    for key in ("critical", "risks", "opportunities", "people"):
        for row in out[key]:
            assert row["score_reason"]
    for group in out["news_by_topic"]:
        for item in group["items"]:
            assert item["score_reason"]


def test_relevance_scale_maps_through_priority_table():
    """relevance is a 1-5 ordinal where 1 = exact match, 5 = tangential
    (see skills/news_search/SKILL.md); it must map through the same
    _PRIORITY_SCORE table priority uses, not a 0-100 scale."""
    assert _briefing._score_of({"relevance": 1}) == 92
    assert _briefing._score_of({"relevance": 2}) == 76
    assert _briefing._score_of({"relevance": 3}) == 55
    assert _briefing._score_of({"relevance": 4}) == 34
    assert _briefing._score_of({"relevance": 5}) == 15


def test_relevance_out_of_range_clamps_to_nearest_valid_end():
    assert _briefing._score_of({"relevance": 0}) == 92    # clamps up to 1 (most relevant)
    assert _briefing._score_of({"relevance": 7}) == 15    # clamps down to 5 (least relevant)


def test_news_quadrant_selects_most_relevant_lowest_numbers():
    """Sorting must select the LOWEST relevance numbers (most relevant), not
    the highest -- this fails against the pre-fix sort, which favored the
    most tangential item."""
    topics = [{"id": 10, "name": "AI", "priority": 1}]
    news = [
        {"id": 1, "title": "tangential", "topic_id": 10, "relevance": 5, "status": "new"},
        {"id": 2, "title": "exact", "topic_id": 10, "relevance": 1, "status": "new"},
    ]
    out = _base(topics=topics, news=news)
    assert [i["id"] for i in out["news_by_topic"][0]["items"]] == [2, 1]


def test_score_reason_relevance_number_matches_score_of():
    row = {"relevance": 3}
    assert str(_briefing._score_of(row)) in _briefing._score_reason(row)
