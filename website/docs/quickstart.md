# Quick Start

Three ways to run Scout EA: the one-line Windows installer, Docker directly, or a
local Python + Node dev setup.

## Windows: one-line installer

If you're on Windows, this is the easiest way to get started. Open **PowerShell as
administrator** and paste this in:

```powershell
irm https://raw.githubusercontent.com/sgtslaughta/scout_ea/main/install/install.ps1 | iex
```

It installs Windows Subsystem for Linux and Docker Desktop if you don't already have
them, downloads Scout EA, and opens the dashboard at <http://localhost:8765>. You'll
be asked to restart your computer once, partway through — after that, run the same
command again and it picks up where it left off.

!!! warning "Untested on real Windows hardware"
    This installer is new and hasn't yet been verified end-to-end on a real Windows
    machine. If it doesn't work for you, fall back to the Docker steps below and
    [open an issue](https://github.com/sgtslaughta/scout_ea/issues).

See [`install/README.md`](https://github.com/sgtslaughta/scout_ea/blob/main/install/README.md)
for troubleshooting and uninstall steps.

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

Scout does nothing until it's connected and its skills are installed. Head to the
**[Setup Wizard](setup-wizard.md)** — it's built into the dashboard (click the sparkle
icon in the top bar) and takes two steps.
