# Scout EA — Overview: Features & Benefits

**Companion to:** `2026-06-20-scout-ea-design.md` (the technical spec)
**Audience:** the executive (you) — what it does and why it matters, no code.
**Date:** 2026-06-20

---

## What it is

A personal **Executive Agent** that runs on your Windows 11 machine. **Microsoft Scout** works in the background — scanning email, Teams, and calendar on a schedule — and records everything important into one local database. A clean **web dashboard** shows it all in one place, live, and lets you act with a click.

One sentence: **Scout watches and drafts; the dashboard shows and decides; nothing leaves your machine.**

---

## How it works (plain language)

1. **Scout scans** your inbox, Teams, and calendar every ~30 min during work hours.
2. It **triages** what matters — who, what, when, why — and writes it to a local database.
3. The **dashboard** displays a live, prioritized view: alerts up top, triaged feed, task/event/research cards.
4. You **click to act** — approve a meeting, mark a task done, dismiss noise.
5. Scout **reacts to your clicks** on its next pass — e.g. drafts the calendar invite you approved.

A closed loop: it proposes, you decide, it executes.

---

## Core features → why it helps you

| Feature | What it does | Benefit |
|---|---|---|
| **Unified triage feed** | Email + Teams + research collapsed into one prioritized list (1=critical → 5=info) | Stop tab-hopping. One screen, ranked by urgency. |
| **Key-personnel awareness** | Flags anything from people you mark as important, across email *and* Teams | VIP messages never buried. |
| **Smart meeting suggestions** | Detects when a thread needs a meeting, proposes 3+ open slots from your calendar | No back-and-forth scheduling. |
| **One-click approvals** | Approve an event in the dashboard → Scout drafts it with attendees + agenda for your review | You stay in control; the busywork is done. |
| **Task tracking** | Action items extracted from messages, with due dates and status | Nothing falls through the cracks. |
| **Weekly research scout** | Every Friday, searches the web/news on your topics, suggests reads with synopsis + links | Stay current without manual searching. |
| **Training radar** | Catches webinars, courses, product news from your inbox and the web | Never miss a learning opportunity. |
| **Live alerts** | Critical items trigger a Windows toast *and* a dashboard banner instantly | React in seconds, even with the tab closed. |
| **Drill-down pages** | Dedicated views: Inbox, Tasks, Calendar, Research, Learning, People, Topics, Settings | Zoom from the big picture to any detail. |

---

## Design qualities (why it's pleasant to use)

- **Reactive** — the screen updates itself the moment Scout writes new data. No refresh button.
- **Data-dense, not cluttered** — tight tables, severity color chips, aligned timestamps. Built to scan fast.
- **Professional aesthetic** — neutral slate palette, single accent, system fonts. Looks like a tool, not a toy.
- **Always-on, low-friction** — launches on login, lives at one local address.

---

## Why this approach (key advantages)

- **Private by design.** Everything runs locally — the database, the server, the dashboard. Bound to your machine only (`127.0.0.1`), no external exposure, no cloud copy of your triage data.
- **Portable & low-maintenance.** Built on Python's standard library — no fragile dependency chain, no build step, no npm. Runs wherever Python runs.
- **Trustworthy automation.** Scout *drafts and suggests*; you approve before anything is sent. The dashboard is the approval gate.
- **Reliable, not leaky.** Smart lookback windows + duplicate detection mean late or skipped scans never drop or double-report items.
- **Extensible.** New research topics, key people, message channels, or item types slot in without rebuilding anything. Grows with your role.
- **Single source of truth.** One database feeds the dashboard, the skills, and any future reporting. No conflicting copies.

---

## What you control

- **People** — who counts as key personnel (drives VIP flagging).
- **Topics** — what subjects the weekly research covers, and how many suggestions per topic.
- **Limits & schedule** — scan frequency, work hours, suggestion caps (Settings page).
- **Every action** — approve, dismiss, complete, save. The agent never sends without your nod.

---

## What it does *not* do (honest scope)

- Does not send email/invites on its own — it drafts and opens for your review.
- Does not expose anything to the internet — local only.
- Does not replace your judgment — it ranks and proposes; you decide.

---

## At a glance

> **Scans** email, Teams, calendar every 30 min · **Triages** into one ranked feed · **Suggests** meetings, reads, training · **Alerts** via Windows toast + dashboard · **Acts** on your one-click approvals · **Stays** entirely on your machine.

For the full technical design — database schema, skills, dashboard implementation — see `2026-06-20-scout-ea-design.md`.
