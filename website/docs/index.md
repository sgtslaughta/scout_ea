# Scout EA

<p align="center">
  <img src="assets/scout_ea_logo.png" alt="Scout EA logo" width="180">
</p>

A personal **Executive Agent** that runs locally. Microsoft Scout scans your email,
Teams, and calendar on a schedule, triages everything into one ranked feed, and
surfaces it in a live "command-deck" web dashboard. **All data stays on your machine.**

<div class="grid cards" markdown>

- :material-rocket-launch: **[Quick Start](quickstart.md)** — up and running with Docker (or the one-line Windows installer) in minutes.
- :material-sitemap: **[Architecture](architecture.md)** — two surfaces over one SQLite DB.
- :material-robot: **[Skills](skills.md)** — the 24 automations that drive Scout.
- :material-wizard-hat: **[Setup Wizard](setup-wizard.md)** — connect Scout, then let it install everything itself.
- :material-tools: **[MCP Tools](mcp-tools.md)** — the 33-tool API skills call.

</div>

## What it does

Scout EA is a single-page dashboard: a sticky top bar (quick links, weather, a finance
ticker, timers), a Calendar rail on the left, a To-do rail on the right, and a
drag-and-drop grid of 9 tiles in the middle — Email, Teams chat, RevOps, Pipeline,
Industry feed, Quarterly events, OU feedback, Territory reviews, and EBC & Innovation
Hub. Settings, People, Topics, and Automations open as drawers or modals over the same
page; there's no separate Settings screen or navigation to get lost in.

- **Drag-and-drop tile grid** — reorder or hide any of the 9 tiles; layout is remembered.
- **To-do rail** — High/Normal/Low priority, Manual/Priority/Status sort, a "High only"
  filter, and a "Hide done" toggle. Turn any row in any tile into a to-do with one click.
- **⌘K command palette**, light / dark + OS detection, accent personalization.
- **Web Push** — critical alerts pushed by a background worker.
- **Trending** — recency-weighted keyword trends with an optional vector layer that merges near-duplicate terms.

## Closed-loop, local-first

Scout's skills read and write a single SQLite database through a bearer-gated **MCP
server**. A live React dashboard reads the same database over HTTP + SSE. Nothing
leaves your machine unless you connect an external Microsoft 365 MCP for real
mail and calendar actions.
