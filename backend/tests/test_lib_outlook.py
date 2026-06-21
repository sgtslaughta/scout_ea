from lib import outlook

NOW = "2026-06-21T09:00:00+00:00"


def test_assemble_shapes_and_countdown():
    deadlines = [{"id": 1, "title": "D", "due_at": "2026-06-21T17:00:00+00:00"}]
    trends = [{"term": f"t{i}", "score": float(i)} for i in range(7)]
    proactive = [{"id": 9, "title": "send card", "type": "proactive"}]
    tasks = [
        {"id": 1, "title": "today", "due_at": "2026-06-21T12:00:00+00:00"},
        {"id": 2, "title": "tomorrow", "due_at": "2026-06-22T12:00:00+00:00"},
    ]
    out = outlook.assemble(NOW, deadlines, trends, proactive, tasks)
    assert out["date"] == "2026-06-21"
    assert out["deadlines"][0]["countdown_seconds"] == 8 * 3600
    assert len(out["top_trends"]) == 5                      # capped at 5
    assert out["proactive"][0]["title"] == "send card"
    assert [t["id"] for t in out["tasks_due_today"]] == [1] # only today's task
