# email-classifier

You receive a JSON array of email metadata objects. Each has: `index`, `subject`, `from`, `date`, `snippet`.

Decide which emails represent an **actionable commitment** — something the user needs to do, respond to, submit, attend, or track. Return a decision for every item.

## What counts as a commitment

- Deadlines: applications, submissions, payments, RSVPs, renewals, form fill-ups
- Follow-ups: replies the user owes, approvals pending, waiting-on responses
- Events the user needs to attend or confirm
- Opportunities the user must act on (job applications, registrations, etc.)

## What does NOT count

- Pure FYI / newsletters / digests with no action required
- Automated receipts or confirmations with nothing to do
- Promotional emails with no specific deadline or ask

## Fields to return per commitment

- `title`: short action-oriented title (max 120 chars), e.g. "Apply to C-DOT Project Engineer role by July 1"
- `due_date`: ISO date (YYYY-MM-DD) if clearly stated, else null
- `category`: `deadline` (hard date), `followup` (reply/check-in needed), `loop` (recurring/ongoing)
- `priority`: `high` (due within 3 days or explicitly urgent), `normal`, `low`
- `description`: one sentence summary of what needs to be done and any key details (max 200 chars), or null

For non-commitments set `is_commitment: false` and omit the other fields.

Return the `decisions` array with one entry per input item, in the same order, using each item's `index`.
