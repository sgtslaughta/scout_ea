from lib import trends

NOW = "2026-06-21T00:00:00+00:00"


def test_aggregate_counts_and_recency(tmp_path=None):
    items = [
        {"term": "ai", "occurred_at": "2026-06-21T00:00:00+00:00"},  # age 0 -> weight 1
        {"term": "ai", "occurred_at": "2026-06-18T00:00:00+00:00"},  # age 3 -> weight 0.5
        {"term": "k8s", "occurred_at": "2026-06-21T00:00:00+00:00"},
    ]
    out = trends.aggregate(items, NOW, half_life_days=3.0)
    by = {r["term"]: r for r in out}
    assert by["ai"]["count"] == 2
    assert abs(by["ai"]["score"] - 1.5) < 1e-6     # 1 + 0.5
    assert by["k8s"]["count"] == 1
    # ai (1.5) ranks above k8s (1.0)
    assert [r["term"] for r in out] == ["ai", "k8s"]


def test_aggregate_future_item_clamped(tmp_path=None):
    items = [{"term": "x", "occurred_at": "2026-06-25T00:00:00+00:00"}]  # future
    out = trends.aggregate(items, NOW)
    assert abs(out[0]["score"] - 1.0) < 1e-6       # age clamped to 0 -> weight 1


def test_compute_delta(tmp_path=None):
    assert trends.compute_delta(2.0, 1.0) == "rising"
    assert trends.compute_delta(1.0, 2.0) == "falling"
    assert trends.compute_delta(1.0, 1.0) == "flat"
    assert trends.compute_delta(1.0, None) == "rising"
    assert trends.compute_delta(0.0, None) == "flat"
