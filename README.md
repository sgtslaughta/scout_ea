# Scout EA

A personal Executive Agent that runs locally on your machine—scans email, Teams, and calendar every 30 minutes, triages information into one ranked feed, and displays live in a web dashboard. All data stays on your machine.

## Quick Start

### Docker (Recommended)
```bash
cp .env.example .env
EA_MCP_TOKEN=$(openssl rand -hex 16) docker compose up
# Open http://127.0.0.1:8765
```

### Dev Mode (Python + Node)
```bash
# Backend
cd backend && pip install -e . && python serve.py

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

## Architecture

- **Backend:** Python FastAPI (web API) + MCP server (skills integration).
- **Frontend:** React + TypeScript (live dashboard with SSE updates).
- **Database:** SQLite (local-only, persistent across sessions).
- **Skills:** 11 automation prompts (heartbeat scans + weekly tasks).

## Docs

- **Design:** `docs/superpowers/specs/2026-06-20-scout-ea-design.md`
- **Skills:** `skills/README.md`
- **UI Stack:** `docs/superpowers/specs/2026-06-21-ui-stack-design.md`
