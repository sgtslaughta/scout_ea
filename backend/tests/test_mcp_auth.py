from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient
from mcp_server.auth import BearerAuthMiddleware

TOKEN = "secret-abc"


def _app():
    async def ok(request):
        return JSONResponse({"ok": True})
    app = Starlette(routes=[Route("/ping", ok)])
    app.add_middleware(BearerAuthMiddleware, token=TOKEN)
    return TestClient(app)


def test_no_header_401():
    assert _app().get("/ping").status_code == 401


def test_wrong_token_401():
    assert _app().get("/ping", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_correct_token_passes():
    r = _app().get("/ping", headers={"Authorization": f"Bearer {TOKEN}"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}
