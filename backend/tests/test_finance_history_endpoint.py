from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_history_rejects_symbol_not_in_watchlist(tmp_path):
    """SSRF guard: the symbol reaches an upstream URL, so only known symbols pass."""
    r = _client(tmp_path).get("/api/finance/history?symbol=evil.example.com&range=1d")
    assert r.status_code == 400


def test_history_rejects_unknown_range(tmp_path):
    r = _client(tmp_path).get("/api/finance/history?symbol=^GSPC&range=10y")
    assert r.status_code == 400


def test_history_accepts_a_valid_watchlist_symbol(tmp_path, monkeypatch):
    import web.app as app_mod

    class _Resp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b'{"chart":{"result":[{"indicators":{"quote":[{"close":[1.0,2.0]}]}}]}}'

    monkeypatch.setattr(app_mod.urllib.request, "urlopen", lambda *a, **k: _Resp())
    # AAPL is in the seeded finance_watchlist config value.
    r = _client(tmp_path).get("/api/finance/history?symbol=AAPL&range=1d")
    assert r.status_code == 200
    assert r.json()["points"] == [1.0, 2.0]


def test_history_returns_graceful_envelope_on_upstream_failure(tmp_path, monkeypatch):
    import web.app as app_mod

    def _boom(*a, **k):
        raise OSError("upstream down")

    monkeypatch.setattr(app_mod.urllib.request, "urlopen", _boom)
    r = _client(tmp_path).get("/api/finance/history?symbol=^GSPC&range=1d")
    assert r.status_code == 200          # never 5xx — the modal must not break
    assert r.json()["points"] == []
    assert r.json()["error"] == "unavailable"
