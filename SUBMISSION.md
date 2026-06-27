# Gappy AI x Lemma SDK Hackathon — Submission

## Problem solved

People's actual commitments — deadlines, follow-ups, recurring tasks, and
important documents — are scattered across Gmail, Calendar, Drive, Docs, and
Sheets, with nothing pulling them into one place. You either remember
everything yourself or build a fragile personal system of starred emails and
half-read calendar invites. This is the hackathon's own curated "LIFE OPS"
problem statement, built for a real, specific user: a working
student/professional juggling academic deadlines, recruiter follow-ups, and
admin paperwork across exactly these five Google services — not a generic
productivity app, a personal command centre for one real inbox.

## Solution approach

**LifeOps** is a Lemma pod + a Vite/React app, built entirely on Lemma SDK
primitives:

- **Table** (`commitments`, RLS-on) — the single source of truth. One row per
  real commitment: title, description, source app + a link back to the
  original item, due date, status (open/done/snoozed), priority, and a
  category (open loop / deadline / recurring / document / follow-up) that
  drives the app's sidebar sections. A `dedup_key` column with a real
  database unique constraint backs the extraction agent's own dedup check —
  not just relying on model judgment.
- **Two agents, deliberately separate** (one-agent-one-job, not one agent
  doing everything):
  - `extraction-agent` — read-only across all 5 connectors
    (`connector.use` grants on gmail/google_calendar/google_drive/
    google_docs/google_sheets), discovers and calls real connector
    operations, judges signal from noise, classifies category, and writes to
    `commitments`. Never sends, deletes, or modifies anything at the source.
  - `briefing-agent` — read-only over `commitments` only (no connector
    access at all), answers free-form questions and produces the daily
    briefing. Two distinct trust boundaries for two distinct jobs.
- **Schedule** — a TIME cron running `extraction-agent` every 5 minutes
  (native LEMMA connectors expose no push triggers in this release —
  confirmed directly via `lemma connectors triggers list`, empty for all 5 —
  so a tight poll is the closest thing to "live" available). A "Check now"
  button in the app triggers the same agent on demand for anything that
  can't wait for the next tick.
- **App** — a sidebar dashboard (Connections, Dashboard, 5 category views, AI
  Briefing) built on `lemma-sdk/react`: `useLiveRecords` for a real-time
  table view with zero polling, `useAgentTask` to call both agents directly
  from the UI, `useCreateRecord`/`useUpdateRecord`/`useDeleteRecord` for
  quick-add and mark-done/snooze/delete. One shared `CommitmentsProvider`
  subscription (not a dozen redundant ones) backs every view.

**A real engineering finding, not hidden:** this Lemma release's
documentation states agents granted a connector get an operation toolset
automatically — that's not actually wired up in the installed backend
(confirmed by reading the source: the connector-tools registry has no
connector entry at all). The working fix was granting `extraction-agent`
`WORKSPACE_CLI` so it discovers and calls connector operations through the
`lemma` CLI in its own shell — a deliberate, documented platform-gap
workaround, not an accident.

## What's real, not a demo script

Every commitment shown was actually detected from a real Gmail inbox,
Calendar, Drive, and Sheets account — including the hackathon's own
registration/submission deadlines, found in a real Google Drive doc, and a
genuine incoming follow-up email mid-build that the agent correctly
classified and tracked within minutes of arriving.

## Team

Solo — Aman.
