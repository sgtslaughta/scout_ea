import sqlite3
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient
from mcp_server.auth import BearerAuthMiddleware
from ea import db

def _app(db_path):
    async def ok(request): return PlainTextResponse("ok")
    app = Starlette(routes=[Route("/mcp", ok, methods=["GET", "POST"])])
    app.add_middleware(BearerAuthMiddleware, token="secret", db_path=db_path)
    return app

def _fresh_db(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.get_conn(p)
    conn.execute("CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value TEXT)")
    conn.commit()
    return p

def test_authed_request_stamps(tmp_path):
    p = _fresh_db(tmp_path)
    c = TestClient(_app(p))
    assert c.get("/mcp", headers={"authorization": "Bearer secret"}).status_code == 200
    row = db.get_conn(p).execute("SELECT value FROM config WHERE key='mcp_last_seen'").fetchone()
    assert row and row[0]

def test_unauthed_request_does_not_stamp(tmp_path):
    p = _fresh_db(tmp_path)
    c = TestClient(_app(p))
    assert c.get("/mcp", headers={"authorization": "Bearer wrong"}).status_code == 401
    row = db.get_conn(p).execute("SELECT value FROM config WHERE key='mcp_last_seen'").fetchone()
    assert row is None
