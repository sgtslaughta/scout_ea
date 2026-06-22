"""M365 passthrough — forwards mail/calendar actions to a configured external M365 MCP.

Graceful: when M365_MCP_URL is unset, returns a 'not_configured' result instead of failing.
"""
from __future__ import annotations
import os

NOT_CONFIGURED = {
    "status": "not_configured",
    "message": "M365 actions are not enabled. Set M365_MCP_URL (and M365_MCP_TOKEN) to connect an external Microsoft 365 MCP.",
}


def configured() -> bool:
    return bool(os.environ.get("M365_MCP_URL"))


def call(action: str, params: dict) -> dict:
    """Forward an action+params to the configured M365 MCP. Returns its JSON, or NOT_CONFIGURED."""
    url = os.environ.get("M365_MCP_URL")
    if not url:
        return dict(NOT_CONFIGURED)
    import httpx
    headers = {}
    token = os.environ.get("M365_MCP_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = httpx.post(
            url.rstrip("/") + "/action",
            json={"action": action, "params": params},
            headers=headers, timeout=20.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:  # ponytail: never crash the agent on an upstream hiccup
        return {"status": "error", "message": f"M365 upstream call failed: {e}"}
