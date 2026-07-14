# Scout EA

<p align="center">
  <img src="assets/scout_ea_logo.png" alt="Scout EA logo" width="180">
</p>

A personal **Executive Agent** that runs locally. Microsoft Scout scans your email,
Teams, and calendar on a schedule, triages everything into one ranked feed, and
surfaces it in a live "command-deck" web dashboard. **All data stays on your machine.**

<div class="grid cards" markdown>

- :material-rocket-launch: **[Quick Start](quickstart.md)** — up and running with Docker in two commands.
- :material-sitemap: **[Architecture](architecture.md)** — two surfaces over one SQLite DB.
- :material-robot: **[Skills](skills.md)** — the 17 automations that drive Scout.
- :material-wizard-hat: **[Setup Wizard](setup-wizard.md)** — install every skill in order, with intervals.
- :material-tools: **[MCP Tools](mcp-tools.md)** — the 29-tool API skills call.

</div>

## What it does

- **Mission-control dashboard** — KPI tiles, live charts, deadline countdowns, signal and Scout-activity feeds; 15 s live refresh.
- **10 views** — Dashboard, Inbox, Tasks, Calendar, Deadlines, Trending, Docs, Settings, People, Topics (full CRUD).
- **Today briefing** — an immersive modal that auto-opens once per day.
- **⌘K command palette**, light / dark + OS detection, accent personalization.
- **Web Push** — critical alerts pushed by a background worker.
- **Trending** — recency-weighted keyword trends with an optional vector layer that merges near-duplicate terms.

## Closed-loop, local-first

Scout's skills read and write a single SQLite database through a bearer-gated **MCP
server**. A live React dashboard reads the same database over HTTP + SSE. Nothing
leaves your machine unless you connect an external Microsoft 365 MCP for real
mail and calendar actions.
