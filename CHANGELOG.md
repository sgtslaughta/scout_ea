# Changelog

Everything notable in Scout EA, newest first. Generated from commit messages.

## 0.9.0 — 2026-08-01


### Accessibility

- **horizon**: Visible focus ring on deadline dots + later cluster


### Bug fixes

- **tasks**: Cycle todo status in the order work actually moves
- **ui**: Bound lists that grow with their data
- **widgets**: Move tile drag handle to the far right
- **ci**: Pin mcp below 2.0
- **dashboard**: Even tile columns, explained todo states, demo data
- **a11y**: Expose weather/finance glyph icons with role="img"
- **briefing**: Correct relevance scale, format quote numbers as chips
- **finance**: Format quote OHLC/volume numbers, split into labelled chips
- **briefing**: Map relevance 1-5 through priority table, fix inverted sort
- **briefing**: Close button z-index, sparkline scale, glyphs, news cap
- **briefing**: Cap Topics News quadrant at 5 items total, not per-topic
- **finance**: Constrain sparkline y-domain so variation isn't flattened
- **briefing**: Raise close button above content wrapper's z-index
- **briefing**: Dark-mode cards, sparkline zones, and review follow-ups
- **finance**: Render actual green/red zones via SVG gradient, not direction colour
- **finance**: Guard parse_quote against non-list open values
- **briefing**: Thread why + timestamp into signal row detail popover
- **briefing**: Resolve quadrant card bg via CSS-var paperChannel
- **briefing**: Restore Escape dismissal, drop mis-scoped role on score badge
- **briefing**: Guard null priority in score_reason to match score_of
- **finance**: Stop ticker popover hover from permanently pinning rotation
- **finance**: Guard parse_history against non-list close values
- **briefing**: Cloud clusters by condition, non-blocking location
- **briefing**: Drift clouds slower and render as puff clusters, density by condition
- **briefing**: Resolve weather location without blocking on geolocation prompt
- **briefing**: Clouds drift full width, arc confined to modal top
- **briefing**: Full-width cloud drift + arc confined to top of modal
- **briefing**: Sky and arc span the full modal height
- **briefing**: Strengthen arc-geometry test, drop dead WeatherBand keyframes
- **briefing**: Move celestial arc to modal-level SkyBackdrop, span full height
- **weather**: Protect forecast strip with its own legibility scrim
- **briefing**: Pin sky backdrop behind scrollable content, not inside it
- **briefing**: Share one live sky-phase clock between modal and weather band
- **weather**: Scrim behind location + temp for daytime legibility
- **test**: Strengthen SkyBackdrop tests to assert rendered output
- **weather**: Pick sun/moon from live phase, not cached is_day
- **weather**: Stretch celestial arc to full band width
- **ci**: Auto-enable GitHub Pages via configure-pages enablement
- **build**: Type-only imports for verbatimModuleSyntax (tsc -b / docker build)
- **finance**: Exclude indices from watchlist split; +regression test, error stale flag, test cleanup
- **weather**: Restore mb:3 spacing under live WeatherBand
- **briefing**: Add polarity to Signal type; drop redundant json import
- **security**: Scheme-guard modal href; extract shared safeHttpUrl helper
- **actions**: Tsc build cast in api.ts + import cleanups
- **actions**: Validate access_url scheme (XSS) + section empty states
- **brand**: Regenerate favicon.ico from logo (multi-size 16/32/48/64)
- **quickdraw**: Gate width transition on prefers-reduced-motion (final-review)
- **timeline**: Thread id through keyboard nav + guard extractId; cleanup
- **timeline**: Individual items deep-link to their view via ?focus=id
- **feed**: Overview passes item category to detail; NewsWire Space-key; mono fallback
- **feed**: Disambiguate DataFeed rail test via aria-current
- **feed**: Restore FeedDetail slide-in (always-mounted, aria-hidden+off-screen when closed)
- **feed**: Unique carousel card key + Space-key activation
- **feed**: Clear seed feed/tag rows in test_tags_db fixture (exact-count asserts)
- **feed**: Clear seed demo feed rows in feed test fixtures (keep people/topics)
- **feed**: Validate topic/person query params as int (was 500 on non-numeric)
- **docs**: Move schedule chip to its own line in detail modal (was overflowing next to title)
- **docs**: SPA /docs no longer shadowed by Swagger; align view to app theme
- **frontend**: Keyboard-operable right-drawer rows (tabIndex + Enter/Space)
- **frontend**: Trending crash (coerce trends.delta to number) + route error boundary
- **mcp**: Bind configurable host (0.0.0.0 in container) so published port is reachable
- **frontend**: App shell layout on MUI Box (last Tailwind classes)
- **frontend**: Delete orphaned ComingSoon; rely on Dialog native Escape
- **frontend**: Contrast-aware check on accent swatches
- **frontend**: Docs buttons on MUI sx (drop inline styles)
- **frontend**: Topics delete action labeled Deactivate
- **frontend**: Drop framer-motion from migrated views; theme dots + richer peeks
- **frontend**: Deadlines view — theme countdown colors, dialog reset, empty state, restored assertions
- **backend**: Allow per-request SQLite conns across FastAPI threadpool threads
- **frontend**: Move Typography system props to sx; drop invalid legend slotProps
- **frontend**: Anchor sidebar active indicator to link edge
- **frontend**: Theme-aware urgent tint + Dialog positioning context
- **frontend**: Export theme as direct createTheme result
- **ui**: Deadline countdown chip uses var(--color-surface-2) so it re-themes in light mode
- **ui**: Remove duplicate horizon bar; make briefing modal controlled (auto-open + working top-bar trigger)
- **ui**: Accept button + horizon now-marker use var(--color-accent) so accent personalization re-tints them
- **ui**: Remove left-rail tooltip that bled over page content (native title remains)
- **ui**: Correct Tailwind v4 setup (@import + @theme), contained card layout, visible horizon
- **ui**: Surfaces+accent+severity render via reliable color values; visible horizon
- **ui**: Apply Tailwind v4 theme, visible horizon signature, surfaces/badges/severity polish
- **mcp**: Env-based db_path/port + fail-closed token in server entry
- **web**: SSE owns one connection per stream — remove leaky global conn cache
- Guard upsert_signal external_ref + CLI error handling
- Add config updated_at touch trigger + test


### Documentation

- Describe the app as it now is
- **skills**: Fix stale MCP-tool listing for two learning skills
- **plan**: Correct inverted importance scale in score_reason test
- **plan**: Correct finance test path to test_lib_finance.py
- **plan**: Make finance rotation test actually able to fail
- **plan**: Three briefing polish implementation plans
- **spec**: Daily briefing polish design
- **plan**: Skill lookback rewrite follow-up
- **wizard**: Scout setup wizard implementation plan
- **wizard**: Scout setup wizard design spec
- **mcp**: Get_entity returns related actions of any status
- Reflect add_event/update_event (29 -> 31 MCP tools)
- **skills**: Document all 17 skills + 29-tool MCP reference
- **mcp**: Capability-expansion implementation plan (9 tasks, TDD)
- **mcp**: Capability-expansion design spec
- **finance**: SP3 finance section implementation plan
- **finance**: SP3 finance section design spec
- **weather**: SP2 animated weather header implementation plan
- **weather**: SP2 animated weather header design spec
- **briefing**: Reference list_rows in daily_briefing gather step
- **briefing**: SP1 super-modal implementation plan
- **briefing**: SP1 super-modal + daily_briefing skill design spec
- **f2**: Timers rework implementation plan (6 tasks)
- **f2**: Timers rework design (multi-timer, continuous alarm, popout window)
- **f3**: Fold Inbox+Actions into Data Feed implementation plan (5 tasks)
- **f3**: Fold Inbox+Actions into Data Feed design (Review dissolves, tabs→chips)
- **f1**: Response detail modal implementation plan (3 tasks)
- **f1**: Response detail modal design (5 W's + reasoning + real actions)
- **sp5**: Nav/routing consolidation implementation plan (6 tasks)
- **consolidation**: Option B frontend consolidation design (5 sub-projects)
- **timers**: SP-B1 implementation plan
- **timers**: SP-B1 productivity timers design spec
- **loud-alerting**: SP-B3 implementation plan
- **loud-alerting**: SP-B3 louder alerting design spec
- **reminders**: Timeline reminders implementation plan
- **reminders**: Timeline reminders design spec
- **actions**: SP-A implementation plans (backend + frontend)
- **actions**: Split Teams into own run_teams executor skill
- **actions**: Runtime is MS Copilot Scout host (scheduler + M365/local bridge)
- **actions**: SP-A Outgoing Actions design spec
- **plan**: Quickdraw action-panel implementation plan (9 tasks, FE-only)
- **spec**: Quickdraw action-panel design (right drawer redesign, FE-only)
- **plan**: SP3 Data Feed newsroom UI — 10-task implementation plan
- **spec**: SP3 Data Feed newsroom UI — viewport-fill reactive page
- **plan**: SP2 Data Feed backend — 6-task implementation plan
- **spec**: SP2 Data Feed backend — learning + news + /api/feed aggregate
- **skills**: Tagging & links convention for content-producing skills
- **plan**: SP1 universal tags & links — 7-task implementation plan
- **spec**: SP1 universal tags & links (Data Feed program foundation)
- **subproject-f**: Tasks kanban board spec
- **subproject-e**: Super-search (FTS5) spec
- **subproject-d**: Horizon bar redesign spec
- **subproject-c**: Spec + plan — interaction consistency (DataGrid/task-edit/activity)
- Sub-Project B plan — multi-theme system (6 tasks)
- Spec — sub-project B multi-theme system (5 validator-locked themes + textures)
- Correct A1 root cause — trends.delta string vs number, not bg.main
- Spec — dashboard overhaul program + sub-project A (bug sweep)
- Phase 3 plan — view migration to MUI + legacy dep removal
- Phase 2 plan — widget-registry dashboard (MUI X, quick-peeks, drill-downs)
- Phase 1 plan — MUI foundation (theme bridge, router, shell)
- Spec — MUI migration + widget-registry dashboard (3 phases)
- Release README — full feature set + Web Push/M365/vectors config
- Plan C-core — MCP tools layer + bearer auth (headless-testable)
- Plan — feature web API (deadlines/config/trends/outlook endpoints)
- Plan C2 — feature backend (migration 002 + deadline/trend logic)
- Plan B — base EA web API (FastAPI HTTP+SSE+control-loop)
- Implementation plan for base EA data foundation (Plan A)
- Lock MCP transport to container port
- Add Source badge (provenance) to UI spec
- UI/stack redesign spec (React+shadcn, two-surface API, container)
- Make outlook/deadlines/trending spec stack-neutral, design-only
- Design spec for Daily Outlook, Critical Deadlines & Trending


### Features

- **mcp**: Migrate to the mcp 2.x SDK
- **install**: One-line Windows installer
- **setup**: Cut the wizard to two steps for non-technical users
- **setup**: One pasted message installs skills, automations and MCP tools
- **setup**: Install every skill with one pasted message
- **tasks**: Create a to-do from any dashboard row
- **tasks**: Priority buckets, sort and filter in the to-do rail
- **revops,people**: RevOps meeting tile, person handles, weather fixes
- **dashboard**: Remaining tiles, todo view options, themed chrome
- **dashboard**: Wire wave A surfaces to real data
- **shell**: Rebuild dashboard as a single-page app
- **weather**: Add per-day condition glyphs to the forecast strip
- **finance**: Reference-line baseline on sparkline popover
- **briefing**: Top-5 grids with plain-english impact explanations
- **skills**: Author a plain-english reasoning sentence per signal
- **briefing**: Full item detail on row hover, with keyboard access
- **briefing**: Impact score explanation with band legend on hover
- **briefing**: HoverCard hover-popover primitive
- **api**: Score_reason on briefing item types
- **briefing**: Plain-english score_reason on every ranked row
- **briefing**: Cap every grid at top 5, sorted by impact
- **briefing**: Paged finance row with hover sparklines
- **finance**: Ticker hover popover with 1d/5d/1w/1m sparklines
- **finance**: Merge watchlist+markets into one paged rotating row
- **finance**: PackPages greedy page-packing helper
- **api**: GetFinanceHistory fetcher + HistoryRange type
- **api**: GET /api/finance/history with symbol whitelist
- **finance**: Parse_history extracts close series from Yahoo chart
- **briefing**: Fix day/night arc and extend sky to full modal
- **briefing**: Full-bleed day/night sky with translucent cards
- **wizard**: Scout 3-step MCP setup wizard
- **wizard**: Step 3 automations — frequency presets, action copy, finish
- **wizard**: Step 2 add skills — hidden body, name-templated copy
- **wizard**: Step 1 connect MCP — name, copy url/token, live validate
- **wizard**: Stepper shell mounted as first Automations tab
- **api**: GetMcpConfig + getMcpStatus fetchers
- **mcp**: Stamp mcp_last_seen on each authed request for wizard validation
- **api**: GET /api/mcp/status returns MCP last-seen timestamp
- **api**: GET /api/mcp/config exposes MCP url + token for wizard
- **config**: Whitelist mcp_name, wizard_done, mcp_last_seen
- **mcp**: Add_event/update_event tools for the events table
- **mcp**: List_action_types tool for self-describing outward actions
- **mcp**: List_skills tool exposes roster + cadence health
- **mcp**: Add_alert tool — LLM can notify the user
- **mcp**: Field-complete add_deadline/add_task/upsert_trend
- **mcp**: Add_signal accepts all structured signal fields
- **mcp**: Get_entity returns row + tags + links + related actions
- **mcp**: Expose search tool over existing FTS index
- **mcp**: Expose query tool (flexible whitelisted reads)
- **mcp**: Db.query read-only whitelisted SELECT primitive
- **briefing-ui**: Ranked scored briefing, weather clock/units/forecast, city picker
- **briefing**: Impact scoring + ranked context; live Yahoo/weather data
- **docs**: Zensical docs site + GHCR/Pages publish pipeline
- **finance**: Wire FinanceStrip into briefing modal + settings watchlist
- **finance**: FinanceStrip chips (watchlist + indices, hover/click)
- **finance**: GetFinance api + Quote/FinanceResponse types
- **finance**: Cached /api/finance Stooq proxy + watchlist config
- **finance**: Pure to_stooq_symbol + parse_quotes helpers
- **weather**: Wire WeatherBand into briefing modal + settings + mostly-fullscreen
- **weather**: Animated WeatherBand (sky/arc/condition FX)
- **weather**: Pure skyPhase + arcFraction math
- **weather**: GetWeather/getConfig api + useWeatherLocation hook
- **weather**: Cached /api/weather Open-Meteo proxy + config keys
- **weather**: Pure classify_code + normalize helpers
- **briefing**: Click-to-nav + hover-detail in briefing modal
- **briefing**: Full-screen command-center TodayBriefing modal
- **briefing**: GetBriefing api + BriefingResponse types
- **briefing**: Daily_briefing skill supersedes daily_outlook
- **briefing**: GET /api/briefing live-assembled endpoint
- **briefing**: Pure lib.briefing.assemble composer
- **briefing**: Signals.polarity column + daily_summary config key
- **timers**: /timers popout window + shared TimersProvider mount
- **timers**: Top pills + bottom drawer in Quickdraw; remove old TimersSection
- **timers**: Shared TimersPanel controls (add/custom/presets/stopwatch/alarm/popout)
- **timers**: Multi-timer hook + TimersProvider context (persist, migrate, sync, alarm)
- **timers**: Repeating alarm loop (startAlarm/stopAlarm)
- **timers**: Multi-timer core model (Timer + per-timer pure fns)
- **feed**: Remove Review, repoint refs to /feed?view=; delete Inbox/Actions/Review views
- **feed**: Render Inbox + Actions sections in DataFeed
- **feed**: FeedActionsSection — actions grouped list
- **feed**: FeedInboxSection — signals with chip filters + detail modal
- **feed**: Register Inbox + Actions rail sections
- **quickdraw**: Open ResponseDetailModal on item click; remove stub reply modal
- **quickdraw**: ResponseDetailModal — 5 W's + AI reasoning + real actions
- **signals**: Reasoning column + migration + add_signal param
- **nav**: Command palette navigates by route registry paths
- **nav**: Grouped 8-item sidebar + tab-container routes + legacy redirects
- **nav**: Registry + TabbedView + Review/Schedule/Automations containers
- **timers**: Timers Quickdraw section (countdown + stopwatch)
- **timers**: UseTimers hook + extract shared playChime to lib/chime
- **timers**: Pure countdown/stopwatch timestamp core
- **loud-alerting**: Settings alert-urgency threshold + sound controls
- **loud-alerting**: Foreground Web Audio chime on new loud alerts
- **loud-alerting**: Service worker persists loud notifications
- **loud-alerting**: Repush_loud_alerts engine + loud push payload
- **loud-alerting**: Repeat_count column + migration + config allowlist
- **reminders**: Settings controls for reminder on/off + lead minutes
- **reminders**: Due-item reminder scan generates warning alerts
- **actions**: Guidance popover + Settings panel
- **actions**: CommandPalette entry for Actions
- **actions**: Wire ActionMenu/Badge into Inbox, People, Feed, Quickdraw
- **actions**: Inline ActionBadge + useEntityActions hook
- **actions**: Actions review queue view + route + nav
- **actions**: Reusable ActionMenu affordance
- **actions**: Generalized ActionComposeModal
- **actions**: FE action registry
- **actions**: FE api types + fetchers
- **actions**: Parallel executor skills (comms/teams/calendar/cowork)
- **actions**: Scout_actions brain skill
- **actions**: Web API for guidance CRUD
- **actions**: Web API for action draft/approve/dismiss
- **actions**: MCP tools for actions + guidance
- **actions**: Guidance add/list/delete primitives
- **actions**: Atomic claim_action + has_open_action dedup
- **actions**: Db add/list/update_action primitives
- **actions**: Actions + guidance tables
- **brand**: Logo in topbar + Help dialog; fix favicon (point to favicon.ico)
- **timeline**: Radar-ping halo on approaching (critical/urgent) axis dots, reduced-motion gated
- **quickdraw**: Shell + masthead + expand toggle; cut App over from RightDrawer
- **quickdraw**: Approaching + Recent Activity sections
- **quickdraw**: Needs Response section (signals+alerts, reply/silence/dismiss)
- **quickdraw**: Collapsible section chrome w/ count + empty micro-copy
- **quickdraw**: Item row with inline/menu actions + destructive confirm
- **quickdraw**: Stub action-compose modal (toast, no backend yet)
- **quickdraw**: Pure data shaping (approaching + needs-response + countdown)
- **quickdraw**: Persisted expand + section-collapse prefs hook
- **quickdraw**: Alert type + getAlerts fetcher; extend Signal detail fields
- **tasks**: Optional due time — local wall-clock date+time input, shown on card
- **timeline**: Tinted per-type color chips (deadline/task/event) in axis + flank popovers
- **feed**: DataFeed shell — viewport-fill, view state, ?view= seed
- **feed**: FeedRail + FeedContextBar
- **feed**: Re-house Trending grid + Topics CRUD as feed sub-views
- **feed**: FeedList news/learning list with origin filter
- **feed**: FeedOverview KPI tiles + carousel + recent stream
- **feed**: FeedDetail slide-in panel
- **feed**: KeyPeopleCarousel
- **feed**: NewsWire headline ticker
- **feed**: Shared feed types + FeedItemCard
- **feed**: News_search skill + demo seed data
- **feed**: FE api types + fetchers for feed/news/learning
- **feed**: MCP tools add_learning/add_news
- **feed**: /api/feed + /api/news + /api/learning + trends tag/origin filter
- **feed**: Lib/feed overview + filter_ids
- **feed**: News_items table + learning/news db helpers
- **tags**: FE primitives — tagColors, TagChips, TagEditor, api
- **tags**: MCP tools tag_content/link_content/list_tags
- **tags**: Web endpoints for tags + content links
- **tags**: Entity-link helpers with label resolution
- **tags**: Schema + tag helpers (universal tagging foundation)
- **deadlines**: Cross-references + tags
- **timeline**: Configurable workday span + events/tasks/deadlines dots + overlap clustering
- **topbar**: Overdue flank left of timeline (mirrors upcoming); extract TimelineFlank
- **topbar**: Condense upcoming date/time + scroll long titles on hover
- **deadlines**: Edit modal, view hidden, TZ-correct due entry
- **topbar**: Upcoming popover — per-item click-to-nav + top-10 with 'more'
- **topbar**: Drop redundant timeline 'later' cluster; upcoming = deadlines+tasks grouped by day/week
- **topbar**: Shrink horizon ~10%, add upcoming-events indicator
- **tasks**: Markdown/rich text in task details
- **kanban**: Tooltips on card + column quick actions; sort asc/desc toggle
- **tasks**: Convert a task to a deadline (task kept)
- **tasks**: Add-task — POST /api/tasks + 'Add task' dialog on the board
- **kanban**: Hover-card priority + proximity countdown chips
- **kanban**: Rich hover card, working complete/dismiss, sort + view-more
- **kanban**: Columns carry a status; drag into column sets task status
- **kanban**: Tasks board — @dnd-kit columns, drag-to-move, card edit modal
- **board**: Board_columns schema + migration + CRUD endpoints; tasks.board_column_id
- **search**: FTS5 super-search across entities in the command palette
- **horizon**: Deadline-mapped SignatureBar with proximity urgency + live time
- **skills**: Active-by-cadence status + rename Docs → Skills
- **calendar**: Friendly time for chosen_time + proposed times (fallback to raw)
- **datetime**: Friendly absolute timestamps + timezone/24h settings
- **docs**: Row click opens skill detail modal; autosize columns to content
- **activity**: First-class /activity DataGrid view + widget drill-down
- **tasks**: Per-item edit modal + PATCH /api/tasks/{id}
- **docs**: Migrate skill cards to MUI X DataGrid (getRowId=name)
- **calendar**: Migrate event cards to MUI X DataGrid with hover-detail
- **frontend**: Settings theme-card picker replaces accent swatches
- **frontend**: Per-theme background textures (mica/scanlines/vignette/grain/dots)
- **frontend**: ThemeSelectionProvider — swappable MUI theme + CSS-var/texture sync
- **frontend**: Theme registry, factory, and 5 validator-locked themes
- **frontend**: Right-drawer items click-to-nav + hover detail
- **frontend**: Test-notification toast surfaces sent count / zero-subs hint
- **frontend**: Manage-widgets checklist menu replaces greyed add-widget
- **frontend**: Sidebar collapse/expand with labels, persisted
- **frontend**: Help dialog (shortcuts + docs link)
- **frontend**: Views honor drill-down query params (due/dir/status/type)
- **frontend**: Widget-grid dashboard — edit mode, layout persistence, today widget
- **frontend**: Trending + skill activity widgets (MUI X BarChart, direct labels)
- **frontend**: Deadlines + signals widgets (compact DataGrid, quick-peek tooltips)
- **frontend**: Widget registry + KPI strip with real-history sparklines
- **frontend**: WidgetCard chrome — count chip, hover toolbar, error boundary, expand dialog
- **frontend**: Dashboard layout module + MUI X deps
- React-router navigation + SPA fallback for deep links
- **frontend**: MUI v7 theme bridge — cssVariables, colorSchemes, accent sync
- **mcp**: M365 passthrough — configurable external M365 MCP broker (graceful not-configured)
- **push**: Background worker pushes new critical alerts (notified_push), wired into server entries
- **ui**: Web Push opt-in — service worker + Settings notifications control
- **push**: Web Push backend — VAPID keygen, subscribe storage, send-to-subs (graceful)
- **lib**: Additive trend vector layer — cosine near-duplicate merge + graceful embeddings
- **ui**: People and Topics management views (CRUD) + rail items
- **web**: People + Topics CRUD (add/edit/soft-delete) endpoints + db helpers
- **seed**: Richer demo data — events (Calendar), learning, people, topics, findings, alerts, varied signal/task statuses
- **ui**: Inbox, Tasks, Calendar views with status actions (replace placeholders)
- **ui**: Light/dark theme with OS detection + working toggle + Settings control; fix activity status icon
- **ui**: Mission-control Dashboard (full-width responsive bento + charts + live activity) + Today briefing modal
- **web**: GET /api/activity (recent skill runs) + db helper + demo seed
- **ui**: ⌘K command palette + Docs skill library + accent personalization (pass 2)
- **web**: GET /api/skills (parse SKILL.md library) for the Docs view
- **ui**: View routing + Deadlines (add/visibility/global toggle) + Trending views + Today actions
- **skills**: 11 Scout SKILL.md automation files + structural validator
- **mcp**: Trend + finding write tools (db helper + tools + FastMCP)
- **container**: Multi-stage Dockerfile + compose (web+mcp), FastAPI serves built frontend
- **ui**: Wire Today + drawer to live API via TanStack Query (+demo seed, web runner)
- **ui**: React command-deck shell + Today view (dawn theme, horizon signature)
- **mcp**: FastMCP server wiring — tools over streamable-http, bearer-gated
- **mcp**: Bearer-token ASGI middleware (loopback gate)
- **mcp**: Agent-facing tools layer over EA_DB (whitelisted reads)
- Due_at validation + add_task/add_skill_run helpers (+ .gitignore)
- **web**: Daily Outlook aggregation endpoint + pure assembler
- **web**: Trends endpoint — ranked list for a window (defaults to latest)
- **web**: Writable config endpoint (whitelisted) for global toggle + settings
- **web**: Deadline endpoints — list w/ countdown, add manual, visibility toggle
- **lib**: Deadline normalization + countdown
- **lib**: Trend aggregation — recency-weighted score + delta
- **db**: Trend helpers — upsert on (term,window) + ranked list
- **db**: Deadline helpers — add/list/visibility with global+row toggle
- **db**: Migration 002 — critical_deadlines, trends, trend_findings + feature config
- **web**: SSE change stream via data_version polling
- **web**: Control-loop status writes via update_status whitelist
- **web**: Read endpoints for signals/tasks/alerts/events
- **web**: FastAPI app skeleton — health + config endpoints
- Ea.init_db CLI; full data-foundation suite green
- Data primitives — dedup upsert, list, status update, data_version
- Seed config + sample person/topic (idempotent)
- EA_DB schema + init (10 tables, triggers, badge/push columns)


### Maintenance

- Expose service ports on all interfaces + track uv.lock
- **compose**: Pass EA_MCP_* env to web service for /api/mcp/config
- Drop enablement flag (Pages enabled on repo)
- **briefing**: Repoint seed + README from daily_outlook to daily_briefing
- **kanban**: Add @dnd-kit/core + @dnd-kit/sortable
- Untrack stray root node_modules cache + gitignore
- **frontend**: Remove tailwind/recharts/framer-motion — single design system
- Untrack stray agent worktree gitlink
- Untrack frontend_dist build artifacts + gitignore
- GitHub Actions — backend pytest, frontend build+vitest, docker build
- **ui**: People/Topics populated screenshots
- **ui**: Clean populated screenshots of all views
- **ui**: Inbox/Tasks/Calendar verification screenshots
- **ui**: Deterministic light/dark dashboard screenshots
- Remove theme verification test scripts
- Revert port to 8765 (canonical), untrack .env+IDE+e2e scripts, gitignore them
- **ui**: Dashboard + briefing screenshots with live data
- **ui**: Verify accent personalization re-tints (emerald)
- **ui**: Real pass-2 screenshots (venv-fixed backend) + remove stray backend/skills
- **ui**: Verification screenshots with correct view navigation
- **ui**: Regenerate polish-1 verification screenshots


### Performance

- **ui**: Code-split views with React.lazy + Suspense (smaller initial bundle)


### Polish

- **reminders**: Relative reminder body + accurate worker docstrings
- **ui**: A11y (form labels, aria, modal Esc/focus), light-mode muted contrast, empty-state copy
- **ui**: Filter chip contrast — dark text on active accent, surface-2 inactive (readable in light)
- **ui**: Real KPI mappings (Proactive), legible chart labels, light-mode colors & contrast
- **ui**: Set document title to Scout EA
- **ui**: Hex→theme utilities, tooltip fix, styled toggle, loading/error states, a11y, staleTime, view tests
- SSE error event, tz-normalize deadlines, rename route handlers, README + .env.example


### Refactoring

- **briefing**: Extract BriefingSections, pass score reasons through
- **weather**: Extract SkyBackdrop with dark-mode muting
- **skills**: Schedule frontmatter reads 'every Nm', not 'heartbeat'
- **skills**: First-run lookback is now - 24h, drop heartbeat fallback
- **skills**: Reference server as {{mcp_name}} token for wizard templating
- **skills**: Replace raw SQL with MCP tool calls + server preamble
- **finance**: Type FinanceStrip renderQuote param as Quote
- **feed**: Route /feed + redirects, sidebar Data Feed, retire Trending/Topics views
- **tags**: Migrate deadlines onto universal tags/links; drop deadline-specific system
- **frontend**: Retire accent personalization; theme.ts is a default-theme shim
- **frontend**: MUI briefing/palette, drop SkeletonRow + orphaned views
- **frontend**: Calendar + Settings views on MUI
- **frontend**: Trending + Docs views on MUI
- **frontend**: People + Topics views on MUI DataGrid + CRUD dialogs
- **frontend**: Inbox + Tasks views → MUI DataGrid
- **frontend**: Deadlines view on MUI DataGrid + form dialog
- **frontend**: Settings theme controls on useColorScheme; drop lib/theme
- **frontend**: RightDrawer + TodayBriefing shell in MUI
- **frontend**: SignatureBar in MUI, mode toggle via useColorScheme
- **frontend**: Sidebar in MUI (IconButton/Tooltip + NavLink)


### Security

- Validate push endpoint (block non-https/localhost/private IPs) — SSRF defense-in-depth
- Per-table column allowlists on insert helpers + constant-time auth compare


### Tests

- **briefing**: Cover Escape on the row detail popover via keyboard focus
- **feed**: Cover proactive toggle, status toggle-off, type preselect
- **tasks**: Drop redundant discarded client in 404 test
- **tasks**: Assert edit dialog submit calls updateTask with changed fields
- **frontend**: Light-mode theme vars + garbage-key fallback coverage
- **frontend**: Fix RouteErrorBoundary reload-recovery test
- **frontend**: Deterministic Inbox wait + SignalsWidget coverage
- **frontend**: Settings mode control wires useColorScheme to ea-theme
- **frontend**: Suppress briefing auto-open in routing tests
- **lib**: Guard deadline weekday next-week + bare-date branches


### Wording

- **kanban**: Clarify delete-column dialog (first remaining column)


