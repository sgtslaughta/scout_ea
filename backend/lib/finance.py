"""Finance helpers — pure: Stooq symbols + light-quote CSV parsing."""
from __future__ import annotations
import csv
import io


def to_stooq_symbol(ticker: str) -> str:
    t = (ticker or "").strip().lower()
    if not t:
        return ""
    if t.startswith("^") or "." in t:
        return t
    return f"{t}.us"


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _display_symbol(raw: str) -> str:
    s = (raw or "").strip().upper()
    if s.endswith(".US"):
        s = s[:-3]
    return s


def parse_quotes(csv_text: str) -> list[dict]:
    out: list[dict] = []
    reader = csv.reader(io.StringIO(csv_text or ""))
    rows = list(reader)
    if not rows:
        return out
    for row in rows[1:]:  # skip header
        if len(row) < 8:
            continue
        sym, date, time, o, h, l, c, vol = row[:8]
        op, cl = _num(o), _num(c)
        change = round((cl - op) / op * 100, 2) if (op and op > 0 and cl is not None) else None
        vnum = _num(vol)
        out.append({
            "symbol": _display_symbol(sym),
            "price": cl,
            "open": op,
            "high": _num(h),
            "low": _num(l),
            "volume": int(vnum) if vnum is not None else None,
            "change_pct": change,
            "date": date,
            "time": time,
        })
    return out
