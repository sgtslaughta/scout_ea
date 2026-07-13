import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app
from web import app as app_mod


def _client(tmp_path, watchlist="AAPL"):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.set_config(conn, "finance_watchlist", watchlist)
    conn.close()
    return TestClient(create_app(p))


# price, prev-close, shortName per Yahoo symbol
_QUOTES = {
    "AAPL": (102.0, 100.0, "Apple Inc."),
    "^GSPC": (5010.0, 5000.0, "S&P 500"),
    "^DJI": (40050.0, 40000.0, "Dow Jones"),
    "^IXIC": (18050.0, 18000.0, "Nasdaq"),
}


def _chart(sym):
    price, prev, name = _QUOTES[sym]
    return {"chart": {"result": [{
        "meta": {"symbol": sym, "shortName": name, "regularMarketPrice": price,
                 "chartPreviousClose": prev, "regularMarketDayHigh": price + 5,
                 "regularMarketDayLow": price - 5, "regularMarketVolume": 5000},
        "indicators": {"quote": [{"open": [prev]}]},
    }]}}


def _fake_urlopen(req, *a, **k):
    from urllib.parse import unquote
    url = getattr(req, "full_url", req)
    sym = unquote(url.split("/chart/")[1].split("?")[0])
    m = MagicMock()
    m.read.return_value = json.dumps(_chart(sym)).encode()
    m.__enter__.return_value = m
    m.__exit__.return_value = False
    return m


def setup_function():
    app_mod._FINANCE_CACHE.clear()


def test_finance_splits_watchlist_and_indices(tmp_path):
    with patch("web.app.urllib.request.urlopen", _fake_urlopen):
        body = _client(tmp_path).get("/api/finance").json()
    assert [q["symbol"] for q in body["watchlist"]] == ["AAPL"]
    assert {q["symbol"] for q in body["indices"]} == {"^GSPC", "^DJI", "^IXIC"}
    assert body["watchlist"][0]["change_pct"] == 2.0
    assert body["watchlist"][0]["name"] == "Apple Inc."
    assert body["stale"] is False


def test_finance_index_in_watchlist_appears_only_in_indices(tmp_path):
    # A symbol that is both user-added and a fixed index must not double-count.
    # ^SPX aliases to ^GSPC, which is a fixed index.
    with patch("web.app.urllib.request.urlopen", side_effect=_fake_urlopen):
        body = _client(tmp_path, watchlist="AAPL,^SPX").get("/api/finance").json()
    assert {q["symbol"] for q in body["watchlist"]} == {"AAPL"}
    assert "^GSPC" in {q["symbol"] for q in body["indices"]}


def test_finance_upstream_failure_degrades(tmp_path):
    def boom(*a, **k):
        raise OSError("down")
    with patch("web.app.urllib.request.urlopen", boom):
        r = _client(tmp_path).get("/api/finance")
    assert r.status_code == 200
    assert r.json()["error"] == "unavailable"


def test_finance_cache_hit_skips_fetch(tmp_path):
    # One Yahoo request per unique symbol: AAPL + 3 indices = 4; second call cached.
    c = _client(tmp_path)
    with patch("web.app.urllib.request.urlopen", side_effect=_fake_urlopen) as mock:
        c.get("/api/finance")
        c.get("/api/finance")
        assert mock.call_count == 4


def test_finance_empty_watchlist_indices_only(tmp_path):
    with patch("web.app.urllib.request.urlopen", _fake_urlopen):
        body = _client(tmp_path, watchlist="").get("/api/finance").json()
    assert body["watchlist"] == []
    assert len(body["indices"]) == 3
