# Life Command Centre: Features To Test

This checklist is based on the current checked-in product surface in `life-cc/` and `pod/`.

## Suggested test order

1. Authentication and onboarding
2. Connector management
3. Manual extraction and sync progress
4. Dashboard and queue views
5. Row actions by source
6. AI briefing and queue Q&A
7. Unclassified inbox
8. Empty states, errors, and edge cases

## Core setup and access

- [ ] Auth gate loads correctly for signed-out and signed-in users.
- [ ] First-time users are redirected to `/onboarding`.
- [ ] Users with onboarding marked `completed` or `skipped` land in the main app instead of getting stuck in onboarding.
- [ ] After onboarding finishes, navigation resumes to the originally requested route.
- [ ] Logout works from the account menu in the sidebar footer.

## Onboarding

- [ ] The onboarding screen renders recommended connectors separately from secondary connectors.
- [ ] Connector status badges show the right state: connected, reconnect needed, disconnected, or coming soon.
- [ ] `Continue` is disabled until at least one recommended connector is connected.
- [ ] `Skip for now` saves onboarding state and unlocks the main app.
- [ ] `Continue` saves onboarding state and best-effort triggers the first extraction run.
- [ ] Returning users do not see onboarding again unless onboarding state is reset.

## Connections

- [ ] `/connections` loads the connector catalog and current account states.
- [ ] Manual refresh re-fetches connector account status.
- [ ] Connect starts the OAuth connect-request flow for supported connectors.
- [ ] Disconnect removes a connected account and refreshes the list.
- [ ] Reconnect is shown for accounts in `REAUTH_REQUIRED`.
- [ ] Connect buttons stay disabled while a connection action is already in flight.
- [ ] Missing org/pod metadata fails cleanly instead of crashing the screen.

## Dashboard

- [ ] Dashboard loads KPI cards for loops, deadlines, recurring tasks, and follow-ups.
- [ ] Greeting renders the signed-in user's display name.
- [ ] Date navigation updates the `?day=` query parameter and refreshes agenda content.
- [ ] Quick Capture creates a manual commitment with the selected category.
- [ ] Quick Capture handles blank input and submission errors cleanly.
- [ ] The selected-day agenda only shows items due on the chosen day.
- [ ] The dashboard shows partial-data messaging when the open queue limit is reached.
- [ ] The embedded Daily Briefing card renders correctly on the dashboard.

## Queue navigation and shared data

- [ ] Sidebar counts match the live commitment data by category.
- [ ] Open Loops, Deadlines, Recurring, Documents, Follow-ups, Snoozed, and Unclassified routes all load.
- [ ] Shared commitment data is deduplicated across live updates, so duplicate rows do not appear in the UI for a single record ID.
- [ ] Open and snoozed lists stay separated correctly.
- [ ] The unclassified count and route reflect `classify_status = unclassified`.

## Commitment row actions

- [ ] Mark done updates a row from open/snoozed to done and removes it from open views.
- [ ] Snooze moves an open item into the Snoozed view.
- [ ] Unsnooze returns a snoozed item to the open queue.
- [ ] Priority badge, due date, source label, and overdue marker render correctly.
- [ ] Full-row action controls only appear in the intended row mode.

## Source-specific actions

### Gmail

- [ ] Gmail commitments show the reply action.
- [ ] Opening reply runs the context-prep function before the agent step.
- [ ] Suggested reply text appears in the editor when the agent succeeds.
- [ ] The user can edit the suggested reply before creating a draft.
- [ ] `Create draft` creates a Gmail draft and shows success feedback.
- [ ] Agent or function failures surface a readable error.

### Google Calendar

- [ ] Calendar commitments show the edit action.
- [ ] Editing title, date, description, location, and attendees saves through the typed function path.
- [ ] Successful saves show confirmation.
- [ ] Invalid edits or backend failures surface clearly.

### Google Drive / Docs / Sheets

- [ ] Drive-file commitments with a `source_ref` open the Google Drive page in a new tab.
- [ ] Docs and Sheets commitments open the in-app preview modal.
- [ ] Document preview loads deterministic content from `preview_document`.
- [ ] Preview loading and preview errors are visible to the user.

## Manual extraction and sync progress

- [ ] `Check now` starts a new extraction run with a fresh `sync_run_id`.
- [ ] The sync popover opens automatically when a run starts.
- [ ] Per-source progress rows render live from `sync_progress`.
- [ ] Connected sources move through pending/running/done as expected.
- [ ] Unconnected sources show as skipped / not connected.
- [ ] Failed sources show warning/error text without breaking the whole UI.
- [ ] Completion summary shows either "All caught up" or a count of new items found.
- [ ] Long-running extractions time out with the intended fallback message.

## AI briefing and AI surfaces

- [ ] Manual briefing refresh starts the `briefing-refresh` workflow.
- [ ] A newly generated briefing replaces the previous one when a fresher row lands.
- [ ] The briefing spinner clears when new content arrives.
- [ ] The `/ai` route shows both the Daily Briefing and Ask AI panels.
- [ ] Ask AI answers common read-only questions using already loaded commitments.
- [ ] Ask AI explicitly refuses mutating requests such as add, delete, reply, or edit.
- [ ] Ask AI works without network-side agent calls for normal queue questions.

## Unclassified inbox

- [ ] The dashboard strip appears when unclassified items exist.
- [ ] `View all` opens `/unclassified`.
- [ ] `Classify with AI` triggers the classification function.
- [ ] Classifying removes items from the unclassified bucket when appropriate.
- [ ] `Dismiss` changes `classify_status` to `not_actionable` without deleting the underlying row.
- [ ] Empty state appears when there are no unclassified items.

## Error handling and resilience

- [ ] Live table read failures render readable error states in affected screens.
- [ ] Connector action failures stay scoped to the affected connector.
- [ ] Sync failures do not leave the UI permanently stuck in a loading state.
- [ ] Briefing refresh failures surface without breaking the rest of the page.
- [ ] Reply, preview, and calendar modal failures remain contained to the modal.

## Lower-priority or rollout-specific checks

- [ ] Auto-refresh for briefing behaves correctly when `VITE_ENABLE_BRIEFING_AUTO_REFRESH=true`.
- [ ] Large commitment sets still show the partial-limit messaging instead of silently truncating.
- [ ] Account display name, avatar initial, and secondary label render correctly for different user profiles.
- [ ] Query-param preservation works while navigating between routes from the sidebar.

## Not in the main acceptance pass

These exist in the repo but are not the main product flow to prioritize unless you are testing rollout internals:

- `action-agent` legacy artifact
- `assistant-agent` as a mutating path
- Telegram surface, which is checked in but disabled
- Older direct-write patterns that the current frontend no longer intends to use
