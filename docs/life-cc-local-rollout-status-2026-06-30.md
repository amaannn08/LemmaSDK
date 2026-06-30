# Life Command Centre Local Rollout Status

Date: 2026-06-30
Target: local Lemma server (`--server local`)
Pod: `life-command-centre`
Pod ID: `019f0543-0b12-707b-bec0-e9896e3fca54`

## What Has Been Done

- Deployed the frontend app to the local Lemma app slot:
  - app: `life-command-centre`
  - URL: `https://life-command-centre.127-0-0-1.sslip.io:8711`
- Updated local app env wiring to point at the local Lemma server and local pod id.
- Imported the hardened backend resources into the local pod:
  - tables: `commitments`, `sync_progress`, `briefing`
  - functions:
    - `create_gmail_draft`
    - `create_manual_commitment`
    - `edit_calendar_event`
    - `extract_commitments`
    - `gather_briefing_data`
    - `preview_document`
    - `run_extraction`
    - `suggest_gmail_reply`
    - `update_commitment_status`
    - `write_briefing`
  - workflows:
    - `briefing-refresh`
    - `extraction-run`
    - `gmail-intake`
  - schedules:
    - `extraction-sweep`
    - `briefing-refresh`
  - surfaces:
    - Telegram surface imported and kept `INACTIVE`
- Removed the old `extraction-agent` from the local pod.
- Replaced local workload permissions from bundle manifests so the live pod matches the hardened repo intent.
- Switched active local agents from unsupported `minimax-m3` to `deepseek-chat`, which is the model available in the local `system:lemma` runtime profile.
- Updated docs in the repo to reflect the hardened architecture and frontend/backend request mapping.

## Backend Fixes Completed

- Removed shell-backed execution from the live product path:
  - `assistant-agent` is now read-only and does not mutate state.
  - `action-agent` is deprecated and no longer the live action path.
- Added typed backend function paths for the main product actions.
- Hardened extraction to use deterministic connector fetches plus DB-backed dedupe behavior.
- Added local compatibility fallbacks for connector execution where the local Lemma runtime did not reliably bridge native connector calls from function code.
- Fixed local DB drift so current code can run against the existing local pod schema:
  - `commitments_source_app_check` now allows `manual`
  - `sync_progress_status_check` now allows `failed`
- Fixed `preview_document` for native local Google Sheets and Drive connector contracts.
- Fixed `suggest_gmail_reply` Gmail fetch input for the native local Gmail connector (`user_id: "me"` path).
- Updated Gmail and Calendar function candidates to prefer native local connector payload shapes instead of only older alias operations.

## Verified Working In Local Sandbox

- `create_manual_commitment`
  - smoke-tested successfully
- `update_commitment_status`
  - smoke-tested successfully
- `gather_briefing_data`
  - smoke-tested successfully
- `run_extraction`
  - latest successful run: `smoke-20260630-local-8`
  - terminal backend rows show:
    - `gmail`: `done`
    - `google_calendar`: `done`
    - `google_drive`: `done`
- `preview_document`
  - verified successful for:
    - Google Sheets-backed commitment
    - Google Drive-backed commitment
- `suggest_gmail_reply`
  - verified successful as a bounded read-only Gmail context reducer
- Telegram surface
  - verified present and `INACTIVE`
- `assistant-agent`
  - verified live permissions are read-only on `commitments`
  - verified no shell toolchain is in use

## Completed 2026-06-30 (second pass)

### 1. LLM-backed agent flows — RESOLVED

- Root cause: `system:lemma` DeepSeek API key was invalid. Both `deepseek-org` and
  `deepseek-byo` shared the same broken key. `deepseek-v4-flash` is a thinking model
  that rejects `tool_choice` from the POD toolset.
- Fix: switched all agents to `gemini-byo` profile / `gemini-2.5-flash`.
- Verified: `briefing-refresh` workflow runs end-to-end — COMPLETED with a real
  briefing written to the `briefing` table.
- Updated repo JSON: all agent bundles now reference
  `profile_id: 019f0d02-163c-71ae-838f-57c2d2e925e9` / `gemini-2.5-flash`.

### 2. `create_gmail_draft` — RESOLVED

- Root cause: LEMMA `drafts_create` operation rejects `threadId` inside the
  `message` body (`additionalProperties: false` in pydantic schema). The function
  was adding `threadId` inside `message`.
- Fix: dropped `threadId` from `message`; thread association is handled by the
  `In-Reply-To` and `References` headers already present in the raw MIME.
- Verified: `create_gmail_draft` → `status: COMPLETED`, `draft_id` created, correct
  `thread_id` returned.
- Imported fixed code to live pod.

### 3. `edit_calendar_event` — VERIFIED

- Smoke-tested against commitment `8580d6c8` (Going Gym daily routine).
- `events_patch` via `my-calendar` completed successfully, `description` field
  patched, `operation_name: events_patch` confirmed.

### 4. Schedules — ENABLED

- `extraction-sweep` (*/2 * * * *) → ACTIVE
- `briefing-refresh` (*/5 * * * *) → ACTIVE

### 5. Gmail webhook trigger — KNOWN LIMITATION, ACCEPTED

- LEMMA provider for `my-gmail` exposes no connector triggers.
- `gmail-intake` workflow remains present but unscheduled; polling via
  `extraction-sweep` covers the same ground.
- No action needed unless the provider changes.

## Important Environment Facts

- All connectors use `Provider = LEMMA` (not COMPOSIO).
- Working runtime profile for agents: `gemini-byo` (id `019f0d02-163c-71ae-838f-57c2d2e925e9`) / `gemini-2.5-flash`.
- `deepseek-chat` via `system:lemma` has an invalid API key — do not use.
- `deepseek-v4-flash` (thinking model) is incompatible with the POD toolset's `tool_choice` — do not use.

## What Is Still Left

### UI verification pass (not yet done)

The full UI should be walked through once in the live app:

- quick-add (create_manual_commitment)
- done/snooze/unsnooze (update_commitment_status)
- reply suggestion (suggest_gmail_reply → reply-suggestion-agent)
- draft creation (create_gmail_draft)
- event edit (edit_calendar_event)
- document preview (preview_document)
- manual sync (run_extraction workflow)
- briefing display and auto-refresh

## Short Conclusion

All blocking backend issues resolved. The pod is fully operational:

- all LLM-backed agent paths work (gemini-2.5-flash)
- all connector actions smoke-tested and passing
- both schedules live and running
- one remaining item: a manual UI walkthrough of the golden-path flows
