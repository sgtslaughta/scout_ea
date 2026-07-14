# Skill Setup Wizard

A guided, step-by-step walkthrough for installing all **17 skills** into Microsoft Scout
**in order**, each with the **exact interval it requires**. Work top to bottom — later
phases depend on earlier ones. Tick each box as you go.

!!! info "Before you begin"
    - Scout EA is running and reachable (`docker compose up -d`, dashboard on `:8765`).
    - The MCP server is up on `:8766` with `EA_MCP_TOKEN` set, and Scout is pointed at it.
    - You install a skill by copying its `skills/<name>/SKILL.md` into Scout's skills
      directory (e.g. `C:\ScoutEA\skills\<name>\SKILL.md`) and setting the schedule below.

    **Order matters:** the outgoing-action executors in Phase 5 do nothing until the
    foundation skills in Phase 1 are producing signals for `scout_actions` to draft against.

---

## Phase 1 — Foundation (triage)

Start here. These skills create the signals and deadlines everything else builds on.
All run on a **30-minute heartbeat, workdays 07:00–18:00**.

- [ ] **1. `triage_email`** — triage inbound email for critical actions, events, key-person replies.
  <br>:material-timer: **Heartbeat every 30 min · workdays 07:00–18:00**
- [ ] **2. `triage_teams`** — triage active Teams chats for critical actions and mentions.
  <br>:material-timer: **Heartbeat every 30 min · workdays 07:00–18:00**
- [ ] **3. `extract_research_training_email`** — flag training and research announcements in email.
  <br>:material-timer: **Heartbeat every 30 min · workdays 07:00–18:00**
- [ ] **4. `parse_deadlines`** — scan signals and mail/chat for hard deadlines.
  <br>:material-timer: **Heartbeat every 30 min · workdays 07:00–18:00**

!!! success "Checkpoint"
    Open the dashboard. Within ~30 minutes you should see signals and deadlines appear.
    Do not proceed until you do — the rest of the pipeline feeds off them.

---

## Phase 2 — Event handling

These turn signals into proposed calendar events. Both run on a **30-minute heartbeat**.

- [ ] **5. `suggest_events`** — read signals implying meetings; suggest times and attendees.
  <br>:material-timer: **Heartbeat every 30 min**
- [ ] **6. `create_events`** — draft calendar invites from approved events for your review.
  <br>:material-timer: **Heartbeat every 30 min**

---

## Phase 3 — Daily automations

Scheduled once per day. Set each to fire at the listed local time.

- [ ] **7. `news_search`** — search current headlines per topic; add deduped, tagged news.
  <br>:material-timer: **Daily at 06:30**
- [ ] **8. `daily_briefing`** — morning briefing: risk/opportunity signals + one-line summary.
  <br>:material-timer: **Daily at 07:00 · workdays only**
- [ ] **9. `compute_trends`** — extract trending keywords/topics with recency-weighted scores.
  <br>:material-timer: **Daily at 08:00**

!!! note "Ordering within the day"
    `news_search` (06:30) runs before `daily_briefing` (07:00) so the briefing can include
    fresh headlines; `compute_trends` (08:00) runs after both so scores reflect the new items.

---

## Phase 4 — Weekly automations

Scheduled once a week. All fire **Friday**, staggered through the day.

- [ ] **10. `research_topics`** — weekly web/news search for developments in active topics.
  <br>:material-timer: **Weekly · Friday 09:00**
- [ ] **11. `compile_learning_email`** — consolidate the week's training/research emails.
  <br>:material-timer: **Weekly · Friday 10:00**
- [ ] **12. `trending_search`** — weekly web/news search for trending content per topic.
  <br>:material-timer: **Weekly · Friday 14:00**

---

## Phase 5 — Outgoing actions (closed loop)

Install these **last**. `scout_actions` drafts outgoing actions from the signals the earlier
phases produced; the four `run_*` executors claim and execute the approved ones.

!!! warning "Drafter before executors"
    Install `scout_actions` first and confirm it is drafting actions (they appear in the
    dashboard's Actions view) **before** enabling any `run_*` executor — the executors only
    act on already-drafted, approved actions.

- [ ] **13. `scout_actions`** — draft outgoing actions from recent signals/deadlines/people. Never executes.
  <br>:material-timer: **Heartbeat every 5 min**
- [ ] **14. `run_comms`** — execute approved email + status actions via M365.
  <br>:material-timer: **Heartbeat every 5 min**
- [ ] **15. `run_teams`** — execute approved Teams chat/group/channel actions.
  <br>:material-timer: **Heartbeat every 5 min**
- [ ] **16. `run_calendar`** — execute approved calendar invite actions.
  <br>:material-timer: **Heartbeat every 5 min**
- [ ] **17. `run_cowork`** — execute collaboration doc/gather actions.
  <br>:material-timer: **Heartbeat every 10 min**

!!! success "Done"
    All 17 skills installed. Every skill logs a `skill_runs` row on each fire (even no-ops),
    so the dashboard's Scout-activity feed and `list_skills` MCP tool show live cadence health.

---

## Interval cheat sheet

| Cadence | Skills |
|---|---|
| Heartbeat 5 min | `scout_actions`, `run_comms`, `run_teams`, `run_calendar` |
| Heartbeat 10 min | `run_cowork` |
| Heartbeat 30 min | `triage_email`, `triage_teams`, `extract_research_training_email`, `parse_deadlines`, `suggest_events`, `create_events` |
| Daily | `news_search` (06:30), `daily_briefing` (07:00), `compute_trends` (08:00) |
| Weekly (Fri) | `research_topics` (09:00), `compile_learning_email` (10:00), `trending_search` (14:00) |
