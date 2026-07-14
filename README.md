<p align="center">
  <img src="frontend/public/scout_ea_logo.png" alt="Scout EA logo" width="160">
</p>

# Scout EA

📖 **[Documentation](https://sgtslaughta.github.io/scout_ea/)** · 🐳 `docker pull ghcr.io/sgtslaughta/scout_ea:latest`

A personal **Executive Agent** that runs locally — Microsoft Scout scans your email, Teams, and calendar on a schedule, triages everything into one ranked feed, and surfaces it in a live "command-deck" web dashboard. All data stays on your machine.

## Quick start

### Docker (recommended)
```bash
cp .env.example .env                       # set EA_MCP_TOKEN (openssl rand -hex 16)
docker compose up -d
docker compose exec web python -c "import seed_demo; seed_demo.seed('/data/ea.sqlite')"   # optional demo data
# open http://127.0.0.1:8765
```

### Dev mode (Python + Node)
```bash
cd backend && pip install -e . && python seed_demo.py && python run_web.py   # API + push worker on :8765
cd frontend && npm install && npm run dev                                     # UI (proxies /api → :8765)
```

## Features

- **Mission-control Dashboard** — KPI tiles, live charts, deadline countdowns, signal + Scout-activity feeds; collapsible panels, 15 s live refresh.
- **10 views** — Dashboard, Inbox, Tasks, Calendar, Deadlines, Trending, Docs (copy-paste skill library), Settings, People, Topics (full CRUD on deadlines / people / topics).
- **Today briefing** — an immersive modal, auto-opens once per day (+ manual trigger).
- **⌘K command palette**, **light / dark + OS detection**, **accent personalization**.
- **Web Push** — opt in under Settings → Notifications; critical alerts are pushed by a background worker.
- **Trending** — recency-weighted keyword trends; an optional vector layer merges near-duplicate terms (see below).

## Architecture

Two surfaces over one SQLite DB:
- **Backend** (`backend/`): FastAPI web API (HTTP + SSE live updates + control-loop writes) on `:8765`, and an **MCP server** (FastMCP, bearer-gated) on `:8766` that Scout's skills call to read/write the DB.
- **Frontend** (`frontend/`): React + TypeScript + Tailwind + shadcn, served as static assets by the API in the container.
- **Skills** (`skills/`): 11 `SKILL.md` automations (heartbeat scans + weekly tasks) — paste them into Microsoft Scout.

## Configuration (`.env`)

| Var | Required | Purpose |
|---|---|---|
| `EA_MCP_TOKEN` | yes | Bearer token gating the MCP server |
| `EA_DB_PATH`, `EA_WEB_PORT`, `EA_MCP_PORT` | no | Path / port overrides |
| `M365_MCP_URL`, `M365_MCP_TOKEN` | no | Connect an external Microsoft 365 MCP to enable real mail/calendar actions (graceful no-op when unset) |

**Optional vector layer:** `pip install -e "backend[vectors]"` installs `sentence-transformers`; trends then merge semantically near-duplicate terms. Without it, trending degrades gracefully to count-based.

## Tests

```bash
cd backend && python -m pytest -q     # 134 tests
cd frontend && npx vitest run         # 28 tests
```

## Docs

- **Specs:** `docs/superpowers/specs/` (base design, UI stack, outlook/deadlines/trending)
- **Plans:** `docs/superpowers/plans/`
- **Skills:** `skills/README.md`
