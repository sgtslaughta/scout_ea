# Scout EA — UI & Stack Redesign — Design Spec

**Date:** 2026-06-21
**Status:** **Design only — no build yet.** Defines the target UI/stack so the feature specs
(`2026-06-21-outlook-deadlines-trending-design.md`) and base spec can be implemented against
a known frontend. Supersedes the base spec's HTMX/SSE/stdlib UI layer; **keeps the base
`EA_DB` schema and skill behavior unchanged**.
**Source brief:** `docs/additions.md`.
**Augments:** `2026-06-20-scout-ea-design.md` (data model + skills), `2026-06-21-outlook-deadlines-trending-design.md` (new features).

---

## 0. Scope & intent

Replace the base spec's stdlib-Python + HTMX/SSE dashboard with a **containerized React app**,
and split data access into **two surfaces over one SQLite DB**:

- **HTTP API (FastAPI + SSE)** — the browser/React consumer.
- **MCP server** — the Scout skills / agent consumer (add/read/remove data).

The `EA_DB` schema, the skills, and their cross-cutting rules are unchanged. This spec covers
the **frontend, the two API surfaces, security, notifications, container, and a self-serve
Docs section**.

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite + React + TypeScript** | Fast, standard, no Next.js server needed (SPA against FastAPI). |
| UI kit | **shadcn/ui + Tailwind** | Owns its components (no runtime dep lock-in); CSS-var theming powers personalization. |
| Modals | **shadcn/Radix `Dialog`** | "Native components" per brief = shadcn/Radix dialogs, **never** OS dialogs or browser `confirm()`/`alert()`. Accessible focus-trap for free. |
| Data/state | **TanStack Query** | Cache, optimistic mutations, SSE-driven invalidation. |
| Charts | **Recharts** (via shadcn charts) | shadcn-native, no extra dep. Sparklines + trend charts. |
| Toasts | **sonner** | shadcn-standard toast. |
| Command palette | **cmdk** | ⌘K nav + quick actions. |
| Motion | **Framer Motion**, used with restraint | One orchestrated welcome + micro-interactions only (see §4.4). |
| Backend (web) | **FastAPI + uvicorn**, SSE for live updates | Async, typed, serves the browser. |
| Backend (agent) | **MCP server** (Python) | Skills call it to add/read/remove `EA_DB` rows + trigger M365 actions. |
| DB | **SQLite (`EA_DB`)**, WAL | Unchanged from base spec. |
| Container | **Multi-stage Docker, Alpine runtime** | Node stage builds static assets; Python/Alpine runtime serves API + MCP + static. |

---

## 2. Architecture — two surfaces, one DB

```
  ┌──────────────┐   HTTP + SSE    ┌──────────────────┐
  │ React SPA    │ ───────────────►│ FastAPI (web)    │──┐
  │ (browser)    │ ◄─────────────── │  /api  /events   │  │   reads/writes
  └──────────────┘   live invalidate└──────────────────┘  │   (WAL)
                                                           ▼
  ┌──────────────┐   MCP (stdio/    ┌──────────────────┐ ┌──────────┐
  │ Scout skills │   http)          │ MCP server       │►│  EA_DB   │
  │ (agent)      │ ───────────────► │  ea.add/get/rm   │ │ (sqlite) │
  └──────────────┘                  │  m365.* passthru │ └──────────┘
                                    └─────────┬────────┘
                                              ▼ delegates actions
                                    ┌──────────────────┐
                                    │ M365 / Microsoft  │
                                    │ MCP (mail/cal/…)  │
                                    └──────────────────┘
```

- **One DB, two doors.** Browser never speaks MCP; skills never speak HTTP. WAL allows
  concurrent reads while either writes — same `PRAGMA data_version` trick drives live updates.
- **MCP server tools** (sketch, finalize at build): `ea.add_signal`, `ea.list(table,filter)`,
  `ea.update_status`, `ea.add_deadline`, `ea.upsert_trend`, `ea.run_skill_log`, plus
  **M365 passthrough** — the MCP server brokers calls to the external **Microsoft/M365 MCP**
  (mail send, calendar create, Teams read) so skills get one tool surface.
- **Live updates:** a FastAPI background task polls `PRAGMA data_version` (~1s); on change it
  emits an SSE `db-changed` event carrying the changed tables; the React client invalidates the
  matching TanStack Query keys. No per-row websocket wiring.

---

## 3. Security

Decision: **local-only, single-user token vault** (no login UI).

- API + MCP bind to **container-internal / `127.0.0.1`** only; never published to a LAN/WAN
  without a deliberate reverse-proxy + auth decision (out of scope here).
- **M365 OAuth tokens** stored in an **encrypted local vault** (key from an env-provided
  secret / OS keyring mount), never in the DB or in plaintext config. Refresh handled by the
  MCP server.
- No secrets baked into the image; injected at runtime (env / mounted secret).
- CORS locked to the app origin. CSP set. `prefers-reduced-motion` honored (a11y, not security,
  but part of the quality floor).

---

## 4. Visual design system

Direction: **"command deck at dawn"** — Scout = reconnaissance for your workday. Not the three
AI-default looks (cream-serif, black-acid-accent, broadsheet).

### 4.1 Color (dark default; accent user-overridable via CSS vars)
```
--bg        #0B1220   deep slate-navy     --text     #E6EDF7
--surface   #131C2B                       --muted    #8A9AB5
--surface-2 #1C2840                       --border   #243149
--accent    #F2A65A   dawn amber          --accent-2 #6C8FE5  pre-dawn indigo
severity:  crit #E5484D · warn #F2A65A · info #6C8FE5 · ok #3DD68C
```
Horizon motif = **amber→indigo** gradient. Light theme + custom accent/background-image are
personalization options (§4.5).

### 4.2 Type
- **Display:** Space Grotesk — briefing headline / view titles, used sparingly.
- **Body/UI:** Inter — dense tables and controls.
- **Data/mono:** JetBrains Mono — countdowns, timestamps (tabular alignment).
Self-hosted (no CDN fetch); subset for size.

### 4.3 Signature element — the day-horizon bar
A persistent top bar rendering **today as a horizon line** (amber→indigo) spanning work hours,
with a ▲ **"now" marker** advancing, and ticks for events / deadlines / meetings. It is the one
bold element; every surrounding surface stays quiet and data-dense. Ties together recon
identity + Daily Outlook + deadline countdowns.

### 4.4 Motion (restrained — corrects brief's "framer everywhere")
- **Welcome (orchestrated, once per load):** horizon line draws left→right; briefing cards
  stagger-fade in. This is *the* moment.
- **Micro:** now-marker subtle pulse; row hover lift; optimistic-action checkmark.
- Nothing else animates. `prefers-reduced-motion` → instant, no draw, no pulse.

### 4.5 Personalization (brief line 7)
shadcn CSS-var theming: user picks **accent color** (re-tints `--accent`), **theme**
(dark/light), optional **background image** (low-opacity behind the shell). Persisted in the
`config` table (per-user keys), applied at boot to avoid flash.

---

## 5. App shell & navigation

Single app-shell, **not multipage** (brief line 13). Views swap in the main region.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◐ SCOUT   [horizon: 7a──9a──▲now──12p───3p───6p]          ⌘K   ⚙     │
├──┬───────────────────────────────────────────────────────┬───────────┤
│▣ │  main view (Today is home)                ◴ Scout 14:32│  context  │
│☷ │                                                        │  drawer   │
│◔ │                                                        │ (deadlines│
│☰ │                                                        │ / trends /│
│↗ │                                                        │  detail)  │
│⚑ │                                                        │           │
│📖│                                                        │           │
├──┴───────────────────────────────────────────────────────┴───────────┤
│  sonner toasts ↘                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Left icon rail:** ▣ Today · ☷ Inbox · ◔ Tasks · ☰ Calendar · ↗ Trending · ⚑ Deadlines ·
  📖 Docs · ⚙ Settings. Collapsible; tooltips on the icon-only rail (brief's "tooltips" applied
  where it earns it — icon controls, not labeled ones).
- **⌘K command palette (cmdk):** jump to any view + quick actions (add deadline, approve event,
  dismiss signal, run trending search). Primary nav for ease-of-use (brief line 14).
- **Right context drawer:** live deadlines + trends by default; swaps to item detail on select.
- **Density toggle** (comfortable/compact) in ⚙ for the data-dense preference.
- **Scout activity indicator** (top-right): last/next skill run from `skill_runs` — makes the
  autopilot feel alive and trustworthy.

---

## 6. Views

| Rail | View | Content (data source) |
|---|---|---|
| ▣ | **Today** (home/hero) | Daily Outlook: today's events, due-today, deadline countdowns, top trends, headlines, **proactive suggestions** (Accept→task / Dismiss). The briefing. |
| ☷ | **Inbox** | `signals` feed; filter by type/status/priority/person; multi-function rows; saved filters. |
| ◔ | **Tasks** | open/in-progress/done; inline complete/dismiss; optimistic. |
| ☰ | **Calendar** | `events` suggestions w/ proposed times; **Approve** → `status='approved'`. |
| ↗ | **Trending** | rising/falling terms (score + delta arrow) w/ sparklines; click → `trend_findings`; per-topic "Run trending search". |
| ⚑ | **Deadlines** | countdown list; **per-row + global visibility toggles**; add-manual via shadcn Dialog. |
| 📖 | **Docs** | quickstart + copy/paste Skills Library (§9). |
| ⚙ | **Settings** | personalization (§4.5), density, `config` editor, M365 connection status, per-skill last-sync. |

Research/Learning/People/Topics surface as **Inbox filters / Settings sub-views**, not separate
rail items (avoid-multipage). All actions write back via `/api`; the control loop is unchanged.

---

## 7. Components & states

- **Modals:** shadcn/Radix `Dialog` only (manual-add deadline, confirm-destructive, event
  approve-with-edit). No OS/browser dialogs.
- **Lists:** multi-function rows (brief line 12) — inline status actions, keyboard select,
  bulk-select where useful.
- **Charts:** Recharts — trend sparklines in lists, trend-over-time on `/trending`.
- **Every list/view defines four states** (frontend-design floor): loading (skeleton),
  empty (an invitation to act — e.g. "No deadlines tracked. Add one or let Scout find them."),
  error (what failed + retry, in the interface's voice), and the MCP/API-down banner.
- **Copy rules:** active voice, action keeps its name through the flow (Approve→"Approved"),
  sentence case, no filler.

---

## 8. Notifications

Decision: **in-app toasts + Web Push** (replaces lost OS toast).

- **In-app:** sonner toast on new `alerts` (rendered when SSE fires) + a persistent alert-bar
  count by severity.
- **Web Push:** service worker + Push subscription; the API pushes **critical (priority ≤ 2)**
  alerts so they reach the user with the tab closed. Opt-in prompt on first run.
- **Single owner:** the web API owns push (mirrors base spec's "server owns toasts") → no
  double-fire; mark `alerts.notified_push=1` after send (small schema add to `alerts`).

---

## 9. Docs section (brief line 17)

**Goal:** Scout EA self-bootstraps. A new user installs the container, opens **📖 Docs**, and
copies skills straight into MS Scout.

- **Quickstart:** what Scout EA is, container run command, connecting M365, how Scout executes
  SKILL.md files, the heartbeat/automation model — short, task-first copy.
- **Skills Library:** one card per skill (the 7 base + 4 new = 11), each rendering the actual
  **SKILL.md body with a Copy button**. Paste-ready into Scout.
- **Single source:** the Docs view reads SKILL.md files from the same `skills/` directory the
  skills run from (served read-only by the API) — never a hand-maintained copy that can drift.

---

## 10. Container & deploy

- **Multi-stage Dockerfile:** stage 1 (node:alpine) builds Vite assets; stage 2
  (python:alpine) installs FastAPI + MCP server + sentence-transformers/sqlite-vec (feature
  spec), copies built assets, runs uvicorn (serves `/api`, `/events`, static) + the MCP server.
- **Volumes:** `EA_DB` sqlite file + token vault on a mounted volume (persist across restarts).
- **Runtime secrets:** M365 client creds + vault key injected via env / mounted secret.
- **One `docker compose up`** brings up the app; Scout runs externally and reaches the MCP
  server (stdio or container port, decided at build).

---

## 11. How this resolves the brief's gaps (summary)

| Brief said | This spec does |
|---|---|
| MCP server for skills | + a **separate HTTP API** for the browser (right tool per consumer). |
| (no live updates) | SSE + `data_version` → TanStack Query invalidation. |
| "Framer everywhere" | **one orchestrated welcome** + micro-interactions; reduced-motion honored. |
| "Tooltips everywhere" | tooltips on **icon-only** controls. |
| "build modals" | **shadcn/Radix Dialog** (native = shadcn, per clarification). |
| (no notif transport) | **sonner + Web Push** (OS toast gone in container). |
| "avoid multipage" | **app-shell + ⌘K + drawer**, Research/People/etc folded into filters. |
| personalization | shadcn CSS-var **accent/theme/bg**, persisted in `config`. |
| Docs w/ copy-paste skills | **Docs view reads `skills/` SKILL.md**, copy buttons. |
| M365 integration | MCP server **brokers the external M365 MCP** as a passthrough. |

---

## 12. Out of scope / deferred (YAGNI)

- Multi-user / role-based auth (single-user local only).
- Network exposure + reverse proxy + real auth (revisit before any non-local deploy).
- Mobile-native app (responsive web is enough; shell collapses to a single column).
- Offline write queue (read-only degrade when API/MCP down is enough for now).
- The implementation plan itself — deferred until base system + these specs are greenlit to build.
