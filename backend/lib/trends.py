"""Trend aggregation — recency-weighted keyword scoring + delta. Pure: no DB/LLM."""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def aggregate(items, now, half_life_days=3.0):
    """items: [{'term', 'occurred_at'(iso)}]. Returns [{'term','count','score'}] score desc.

    score = sum over occurrences of 0.5 ** (age_days / half_life_days); future ages clamp to 0.
    """
    now_dt = _parse(now)
    counts = defaultdict(int)
    scores = defaultdict(float)
    for it in items:
        term = it["term"]
        age_days = (now_dt - _parse(it["occurred_at"])).total_seconds() / 86400.0
        if age_days < 0:
            age_days = 0.0
        counts[term] += 1
        scores[term] += 0.5 ** (age_days / half_life_days)
    out = [{"term": t, "count": counts[t], "score": round(scores[t], 6)} for t in counts]
    out.sort(key=lambda r: (-r["score"], r["term"]))
    return out


def compute_delta(curr_score, prev_score, threshold=0.15):
    """Classify movement vs prior window. threshold = fractional change."""
    if prev_score is None or prev_score == 0:
        return "rising" if curr_score > 0 else "flat"
    change = (curr_score - prev_score) / prev_score
    if change > threshold:
        return "rising"
    if change < -threshold:
        return "falling"
    return "flat"
