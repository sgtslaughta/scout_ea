"""Bearer-token gate for the MCP server's HTTP transport (loopback, single shared token)."""
from __future__ import annotations
import hmac
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class BearerAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, token):
        super().__init__(app)
        self._expected = f"Bearer {token}"

    async def dispatch(self, request, call_next):
        provided = request.headers.get("authorization", "") or ""
        if not hmac.compare_digest(provided, self._expected):
            return JSONResponse({"detail": "unauthorized"}, status_code=401)
        return await call_next(request)
