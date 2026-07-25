# Skill lookback rewrite — drop the heartbeat fallback

Follow-up to `2026-07-14-scout-setup-wizard.md` ("Deferred" section). Not part of
the wizard; safe to ship independently.

## Why

The setup wizard moved run timing into Scout automations (Step 3 frequency
presets). Skill bodies still compute their own first-run fallback window from a
`heartbeat_minutes` value that no longer has a source of truth — nothing sets it,
and no scheduler reads it. Replace it with one uniform bootstrap window.

## Global constraint: `schedule:` frontmatter stays

The original deferred note suggested dropping or updating the `schedule:` line.
**Do not remove it.** It is live input to skill-health monitoring:

- `backend/lib/skills.py:21` — reads `meta["schedule"]` into the skill record
- `backend/lib/skill_health.py::expected_interval_seconds` — parses the freeform
  text (`"heartbeat 30m, workdays 07:00-18:00 EST"`, `"automation, daily 08:00 EST"`)
  into an expected cadence; `is_active` marks a skill stale at 2× that interval
- `backend/mcp_server/tools.py:159` and `backend/web/app.py:608` — set the
  per-skill `active` flag from it
- `backend/tests/test_skills_structure.py:61` — asserts every skill has one
- `backend/tests/test_actions_skills.py:10` — asserts `"5m" in scout_actions.schedule`

After this change `schedule:` means *declared expected cadence, for health
monitoring only* — not a runtime trigger. Reuse `expected_interval_seconds`; do
not add a second parser.

---

## Task 1: Replace the heartbeat fallback in the 6 affected bodies

**Files (all at line 13, under `## Lookback window`):**

- `skills/triage_email/SKILL.md`
- `skills/triage_teams/SKILL.md`
- `skills/parse_deadlines/SKILL.md`
- `skills/create_events/SKILL.md`
- `skills/suggest_events/SKILL.md`
- `skills/extract_research_training_email/SKILL.md`

The other 5 skills carrying `heartbeat` (`scout_actions`, `run_comms`,
`run_teams`, `run_calendar`, `run_cowork`) have it in frontmatter only — no body
edit, see Task 2.

**Transformation** — one identical substring in each file:

```
If none exists, use `now - heartbeat_minutes` (default 30 min).
```
becomes
```
If none exists (first run), use `now - 24h`.
```

Leave the rest of each line untouched — the trailing connector-specific sentence
(`Query Scout's email connector for messages received in [window_start, now].`)
differs per skill and must survive verbatim.

`24h` is uniform across all skills by decision: one rule, no per-skill tuning, and
it matches `skill_health._FALLBACK_GRACE_SECONDS`.

- [ ] **Step 1: Apply the edit to all 6 files**
- [ ] **Step 2: Verify no body references remain**

```bash
cd /home/user/code/Scout_EA
grep -rn "heartbeat_minutes" skills/ || echo "none"   # expect: none
grep -rn "now - 24h" skills/ | wc -l                  # expect: 6
```

- [ ] **Step 3: Confirm the connector sentences survived**

```bash
grep -n "Lookback" -A1 skills/triage_email/SKILL.md skills/triage_teams/SKILL.md
```
Expected: each still ends with its own connector sentence.

- [ ] **Step 4: Commit**

```bash
git add skills/
git commit -m "refactor(skills): first-run lookback is now - 24h, drop heartbeat fallback"
```

---

## Task 2: Reword `schedule:` frontmatter (optional, health-preserving)

The word "heartbeat" in `schedule:` is now misleading — Scout automations drive
runs. Rewording is cosmetic and must not change what
`expected_interval_seconds` extracts.

Per file: `schedule: heartbeat 30m, ...` → `schedule: every 30m, ...` (same for
`5m` / `10m`). The `_INTERVAL_RE` regex matches the `<number><unit>` token
regardless of the surrounding words, so cadence parsing is unchanged, and
`test_actions_skills.py:10`'s `"5m" in ...` assertion still holds.

Affected: the 11 files listed by `grep -rn "schedule: heartbeat" skills/`.

- [ ] **Step 1: Reword all 11**
- [ ] **Step 2: Verify health parsing is unchanged**

```bash
cd backend && ../.venv/bin/python -m pytest -q -k "skill"
```
Expected: green, same count as before the edit.

- [ ] **Step 3: Commit**

```bash
git add skills/
git commit -m "refactor(skills): schedule frontmatter reads 'every Nm', not 'heartbeat'"
```

Skip this task entirely if the wording churn isn't worth it — Task 1 is the
substantive change.

---

## Verification

```bash
cd /home/user/code/Scout_EA
grep -rn "heartbeat_minutes" skills/    # no hits
cd backend && ../.venv/bin/python -m pytest -q   # expect 300 passed
```

Behavioral check: the `active` flag on `/api/skills` (and the MCP `skills` tool)
should be identical before and after — this change touches skill prose and, in
Task 2, cadence wording that parses to the same interval.
