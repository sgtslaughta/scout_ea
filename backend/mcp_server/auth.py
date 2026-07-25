"""Bearer-token gate for the MCP server's HTTP transport (loopback, single shared token)."""
from __future__ import annotations
import hmac
from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from ea import db


class BearerAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, token, db_path=None):
        super().__init__(app)
        self._expected = f"Bearer {token}"
        self._db_path = db_path

    async def dispatch(self, request, call_next):
        provided = request.headers.get("authorization", "") or ""
        if not hmac.compare_digest(provided, self._expected):
            return JSONResponse({"detail": "unauthorized"}, status_code=401)
        self._stamp()
        return await call_next(request)

    def _stamp(self):
        # ponytail: best-effort last-seen for the wizard's connection check;
        # never let a bookkeeping write break an MCP request.
        if not self._db_path:
            return
        try:
            conn = db.get_conn(self._db_path)
            db.set_config(conn, "mcp_last_seen", datetime.now(timezone.utc).isoformat())
        except Exception:
            pass
