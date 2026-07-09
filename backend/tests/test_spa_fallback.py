"""Deep links like /inbox must serve index.html (SPA fallback)."""
from pathlib import Path

from fastapi.testclient import TestClient

from web.app import create_app


def _mk_static(tmp_path: Path) -> Path:
    static = tmp_path / "dist"
    static.mkdir()
    (static / "index.html").write_text("<html><body>scout</body></html>")
    return static


def test_deep_link_serves_index(tmp_path):
    app = create_app(tmp_path / "t.sqlite", static_dir=_mk_static(tmp_path))
    client = TestClient(app)
    r = client.get("/inbox")
    assert r.status_code == 200
    assert "scout" in r.text


def test_api_404_still_404(tmp_path):
    app = create_app(tmp_path / "t.sqlite", static_dir=_mk_static(tmp_path))
    client = TestClient(app)
    assert client.get("/api/nope").status_code == 404
