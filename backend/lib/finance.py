"""Finance helpers — pure: Yahoo symbols + chart-JSON quote parsing."""
from __future__ import annotations

# Old Stooq index tickers → Yahoo equivalents (back-compat for stored watchlists).
_INDEX_ALIASES = {"^SPX": "^GSPC", "^NDQ": "^IXIC"}


def to_yahoo_symbol(ticker: str) -> str:
    t = (ticker or "").strip().upper()
    if not t:
        return ""
    if t.endswith(".US"):  # legacy Stooq suffix
        t = t[:-3]
    return _INDEX_ALIASES.get(t, t)


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_quote(result: dict) -> dict | None:
    """One Yahoo v8 chart `result[0]` dict → quote dict (None if unusable)."""
    m = (result or {}).get("meta") or {}
    sym = (m.get("symbol") or "").upper()
    if not sym:
        return None
    price = _num(m.get("regularMarketPrice"))
    prev = _num(m.get("chartPreviousClose"))
    change = round((price - prev) / prev * 100, 2) if (price is not None and prev) else None
    q = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    open_vals = q.get("open")
    if not isinstance(open_vals, (list, tuple)):
        open_vals = []
    opens = [x for x in open_vals if x is not None]
    vol = _num(m.get("regularMarketVolume"))
    return {
        "symbol": sym,
        "name": m.get("shortName") or sym,
        "price": price,
        "open": _num(opens[-1]) if opens else None,
        "high": _num(m.get("regularMarketDayHigh")),
        "low": _num(m.get("regularMarketDayLow")),
        "volume": int(vol) if vol is not None else None,
        "change_pct": change,
    }


def parse_history(result: dict) -> list[float]:
    """One Yahoo v8 chart `result[0]` dict → close-price series, nulls dropped.

    Yahoo writes null for gaps (market closed, thin trading); SparkLineChart
    cannot render those, so they are dropped rather than interpolated.
    """
    q = (((result or {}).get("indicators") or {}).get("quote") or [{}])[0]
    closes = q.get("close")
    if not isinstance(closes, (list, tuple)):
        closes = []
    out = []
    for v in closes:
        n = _num(v)
        if n is not None:
            out.append(n)
    return out
