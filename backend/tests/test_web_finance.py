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


_CSV = (
    "Symbol,Date,Time,Open,High,Low,Close,Volume\n"
    "AAPL.US,2026-07-13,22:00,100.0,105.0,99.0,102.0,5000\n"
    "^SPX,2026-07-13,22:00,5000.0,5050.0,4990.0,5010.0,0\n"
    "^DJI,2026-07-13,22:00,40000,40100,39900,40050,0\n"
    "^NDQ,2026-07-13,22:00,18000,18100,17900,18050,0\n"
)


def _fake_urlopen(*a, **k):
    m = MagicMock()
    m.read.return_value = _CSV.encode()
    m.__enter__.return_value = m
    m.__exit__.return_value = False
    return m


def setup_function():
    app_mod._FINANCE_CACHE.clear()


def test_finance_splits_watchlist_and_indices(tmp_path):
    with patch("web.app.urllib.request.urlopen", _fake_urlopen):
        body = _client(tmp_path).get("/api/finance").json()
    assert [q["symbol"] for q in body["watchlist"]] == ["AAPL"]
    assert {q["symbol"] for q in body["indices"]} == {"^SPX", "^DJI", "^NDQ"}
    assert body["watchlist"][0]["change_pct"] == 2.0
    assert body["stale"] is False


def test_finance_index_in_watchlist_appears_only_in_indices(tmp_path):
    # A symbol that is both user-added and a fixed index must not double-count.
    with patch("web.app.urllib.request.urlopen", side_effect=_fake_urlopen):
        body = _client(tmp_path, watchlist="AAPL,^SPX").get("/api/finance").json()
    assert {q["symbol"] for q in body["watchlist"]} == {"AAPL"}
    assert "^SPX" in {q["symbol"] for q in body["indices"]}


def test_finance_upstream_failure_degrades(tmp_path):
    def boom(*a, **k):
        raise OSError("down")
    with patch("web.app.urllib.request.urlopen", boom):
        r = _client(tmp_path).get("/api/finance")
    assert r.status_code == 200
    assert r.json()["error"] == "unavailable"


def test_finance_cache_hit_skips_fetch(tmp_path):
    c = _client(tmp_path)
    with patch("web.app.urllib.request.urlopen", side_effect=_fake_urlopen) as mock:
        c.get("/api/finance")
        c.get("/api/finance")
        assert mock.call_count == 1


def test_finance_empty_watchlist_indices_only(tmp_path):
    with patch("web.app.urllib.request.urlopen", _fake_urlopen):
        body = _client(tmp_path, watchlist="").get("/api/finance").json()
    assert body["watchlist"] == []
    assert len(body["indices"]) == 3
