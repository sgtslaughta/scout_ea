# Quick Start

Two ways to run Scout EA: Docker (recommended) or a local Python + Node dev setup.

## Docker

```bash
cp .env.example .env                       # set EA_MCP_TOKEN (openssl rand -hex 16)
docker compose up -d
# optional demo data:
docker compose exec web python -c "import seed_demo; seed_demo.seed('/data/ea.sqlite')"
```

Then open <http://127.0.0.1:8765>.

!!! tip "Pull the pre-built image"
    Every push to `main` publishes the app image to the GitHub Container Registry:
    ```bash
    docker pull ghcr.io/sgtslaughta/scout_ea:latest
    ```

## Dev mode (Python + Node)

```bash
# backend: API + push worker on :8765
cd backend && pip install -e . && python seed_demo.py && python run_web.py

# frontend: UI (proxies /api → :8765)
cd frontend && npm install && npm run dev
```

## Configuration (`.env`)

| Var | Required | Purpose |
|---|---|---|
| `EA_MCP_TOKEN` | yes | Bearer token gating the MCP server |
| `EA_DB_PATH`, `EA_WEB_PORT`, `EA_MCP_PORT` | no | Path / port overrides |
| `M365_MCP_URL`, `M365_MCP_TOKEN` | no | Connect an external Microsoft 365 MCP for real mail/calendar actions (graceful no-op when unset) |

!!! note "Optional vector layer"
    `pip install -e "backend[vectors]"` installs `sentence-transformers`; trends then
    merge semantically near-duplicate terms. Without it, trending degrades gracefully
    to count-based.

## Next step

Scout does nothing until you install its skills. Head to the
**[Setup Wizard](setup-wizard.md)** to install all 17 in order with their required intervals.
