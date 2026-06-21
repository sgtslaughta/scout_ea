"""Trend vector layer — cosine merge of near-duplicate terms + optional embeddings.

Embeddings are ADDITIVE and graceful: if sentence-transformers is unavailable,
embed() returns None and callers fall back to count-based trends.
"""
from __future__ import annotations
import math

_MODEL = None
_MODEL_TRIED = False


def cosine(a, b) -> float:
    """Cosine similarity of two equal-length float vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def merge_similar(items, threshold=0.85):
    """Merge near-duplicate trend terms.

    items: list of dicts each with 'term', 'score' (float), and optional 'embedding' (list[float]).
    Items whose embeddings have cosine >= threshold collapse into one (highest-score term kept;
    scores summed; 'merged' lists the absorbed terms). Items without an embedding are never merged.
    Returns a new list, highest score first.
    """
    out = []
    for it in sorted(items, key=lambda x: -x.get("score", 0)):
        emb = it.get("embedding")
        placed = False
        if emb is not None:
            for rep in out:
                if rep.get("embedding") is not None and cosine(emb, rep["embedding"]) >= threshold:
                    rep["score"] = rep.get("score", 0) + it.get("score", 0)
                    rep.setdefault("merged", []).append(it["term"])
                    placed = True
                    break
        if not placed:
            out.append(dict(it))
    out.sort(key=lambda x: -x.get("score", 0))
    return out


def available() -> bool:
    """True if the embedding model can be loaded."""
    return _load() is not None


def _load():
    global _MODEL, _MODEL_TRIED
    if _MODEL_TRIED:
        return _MODEL
    _MODEL_TRIED = True
    try:
        from sentence_transformers import SentenceTransformer
        _MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        _MODEL = None
    return _MODEL


def embed(text):
    """Return a list[float] embedding for text, or None if the model is unavailable."""
    m = _load()
    if m is None:
        return None
    return [float(x) for x in m.encode(text)]
