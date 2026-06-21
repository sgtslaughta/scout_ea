import math
import pytest
from lib import vectors


def test_cosine_basic():
    assert vectors.cosine([1, 0], [1, 0]) == 1.0
    assert vectors.cosine([1, 0], [0, 1]) == 0.0
    assert abs(vectors.cosine([1, 1], [1, 1]) - 1.0) < 1e-9
    assert vectors.cosine([0, 0], [1, 1]) == 0.0  # zero-vector guard


def test_merge_collapses_near_duplicates():
    items = [
        {"term": "ai agents", "score": 10.0, "embedding": [1.0, 0.0, 0.0]},
        {"term": "agentic ai", "score": 4.0, "embedding": [0.99, 0.01, 0.0]},  # ~dup
        {"term": "kubernetes", "score": 6.0, "embedding": [0.0, 1.0, 0.0]},     # distinct
    ]
    out = vectors.merge_similar(items, threshold=0.9)
    terms = [o["term"] for o in out]
    assert "ai agents" in terms and "kubernetes" in terms
    assert "agentic ai" not in terms                       # absorbed
    ai = next(o for o in out if o["term"] == "ai agents")
    assert ai["score"] == 14.0                              # 10 + 4
    assert "agentic ai" in ai.get("merged", [])


def test_merge_keeps_items_without_embeddings():
    items = [
        {"term": "a", "score": 5.0},                        # no embedding
        {"term": "b", "score": 3.0},
    ]
    out = vectors.merge_similar(items)
    assert {o["term"] for o in out} == {"a", "b"}


def test_embed_graceful_when_absent():
    # embed returns None OR a list — never raises. available() matches.
    v = vectors.embed("hello world")
    assert v is None or (isinstance(v, list) and len(v) > 0)
    assert isinstance(vectors.available(), bool)


@pytest.mark.skipif(
    not vectors.available(),
    reason="sentence_transformers not available"
)
def test_embed_returns_384_dim_with_model():
    """Test that embeddings are 384-dim and cosine dist reflects semantics."""
    dup_a = vectors.embed("ai agents")
    dup_b = vectors.embed("agentic ai workflows")
    diff = vectors.embed("kubernetes networking")

    assert dup_a is not None and len(dup_a) == 384
    assert dup_b is not None and len(dup_b) == 384
    assert diff is not None and len(diff) == 384

    sim_dup = vectors.cosine(dup_a, dup_b)
    sim_diff = vectors.cosine(dup_a, diff)
    assert sim_dup > sim_diff, f"Expected dup similarity ({sim_dup}) > diff similarity ({sim_diff})"
