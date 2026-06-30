# Life Command Centre Frontend Request Map

This map describes the request surface in the current frontend code.

Important deployment note:

- The code in this checkout targets the function-backed hardened pod contract.
- If the live pod has not been re-imported yet, some runtime calls will still point at older resources.

## Request Inventory

| Feature | Frontend file | Request type | Current target | Notes |
| --- | --- | --- | --- | --- |
| Auth bootstrap | `life-cc/src/main.tsx`, `life-cc/src/lemma-client.ts` | auth/session | Lemma auth APIs | Shared auth gate before app render |
| Open queue feed | `life-cc/src/CommitmentsContext.tsx` | live table subscription | `commitments` | `status = open`, capped at `500` |
| Snoozed feed | `life-cc/src/CommitmentsContext.tsx` | live table subscription | `commitments` | `status = snoozed`, capped at `200` |
| Briefing feed | `life-cc/src/BriefingContext.tsx` | live table subscription | `briefing` | latest saved briefing row |
| Manual briefing refresh | `life-cc/src/BriefingContext.tsx` | workflow run | `briefing-refresh` | manual, plus runtime opt-in auto refresh |
| Sync progress feed | `life-cc/src/useSyncProgress.ts` | live table subscription | `sync_progress` | rows scoped by `sync_run_id` |
| Manual sync trigger | `life-cc/src/SyncButton.tsx` | function run | `run_extraction` | deterministic ingestion wrapper |
| Quick add | `life-cc/src/Dashboard.tsx` | function run | `create_manual_commitment` | replaces raw record create |
| Done / snooze / unsnooze | `life-cc/src/CommitmentItem.tsx` | function run | `update_commitment_status` | canonical status mutation path |
| Connector account list | `life-cc/src/ConnectionsScreen.tsx` | query | connector account APIs | reads org connection state |
| Connector connect | `life-cc/src/ConnectionsScreen.tsx` | mutation | connect-request API | starts OAuth redirect |
| Connector disconnect | `life-cc/src/ConnectionsScreen.tsx` | mutation | connector account APIs | removes linked account |
| Gmail reply suggestion prep | `life-cc/src/actions/ReplyPanel.tsx` | function run | `suggest_gmail_reply` | sanitizes context before agent use |
| Gmail reply text generation | `life-cc/src/actions/ReplyPanel.tsx` | agent task | `reply-suggestion-agent` | no tool calls, no side effects |
| Gmail draft commit | `life-cc/src/actions/ReplyPanel.tsx` | function run | `create_gmail_draft` | deterministic side effect |
| Calendar event edit | `life-cc/src/actions/EditEventForm.tsx` | function run | `edit_calendar_event` | deterministic side effect |
| Document preview | `life-cc/src/actions/DocViewer.tsx` | function run | `preview_document` | deterministic fetch and render |
| Ask AI panel | `life-cc/src/AskAi.tsx` | local in-memory answer | none | no network call; uses loaded commitments only |

## Route-Level Mapping

### `/dashboard`

Reads:

- live open commitments feed
- live snoozed commitments feed indirectly through shared provider state
- live briefing feed

Writes and triggers:

- `create_manual_commitment`
- `briefing-refresh`
- `run_extraction` through the shared `SyncButton`

### `/connections`

Reads:

- pod metadata for `organization_id`
- connector accounts list

Writes and triggers:

- connector connect request
- connector disconnect

### `/loops`, `/deadlines`, `/recurring`, `/documents`, `/followups`

Reads:

- shared live commitments feed filtered client-side by category

Writes and triggers:

- `update_commitment_status`
- source-specific action function paths through `ActionTrigger`

### `/snoozed`

Reads:

- shared live snoozed feed

Writes and triggers:

- `update_commitment_status` for unsnooze or done

### `/ai`

Reads:

- live briefing feed
- locally loaded open and snoozed commitments

Writes and triggers:

- `briefing-refresh`
- no agent/network mutation path from `AskAi`

## Current Frontend Data Reads

### `commitments`

Source:
`life-cc/src/CommitmentsContext.tsx`

Open queue query:

```ts
useLiveRecords({
  client: lemmaClient,
  tableName: 'commitments',
  filters: [{ field: 'status', op: 'eq', value: 'open' }],
  sort: [{ field: 'due_date', direction: 'asc' }],
  limit: 500,
  reconcile: 'refetch',
})
```

Snoozed query:

```ts
useLiveRecords({
  client: lemmaClient,
  tableName: 'commitments',
  filters: [{ field: 'status', op: 'eq', value: 'snoozed' }],
  sort: [{ field: 'due_date', direction: 'asc' }],
  limit: 200,
  reconcile: 'refetch',
})
```

### `briefing`

Source:
`life-cc/src/BriefingContext.tsx`

```ts
useLiveRecords({
  client: lemmaClient,
  tableName: 'briefing',
  sort: [{ field: 'generated_at', direction: 'desc' }],
})
```

### `sync_progress`

Source:
`life-cc/src/useSyncProgress.ts`

```ts
useLiveRecords({
  client: lemmaClient,
  tableName: 'sync_progress',
  filters: runId ? [{ field: 'sync_run_id', op: 'eq', value: runId }] : [{ field: 'sync_run_id', op: 'eq', value: '__none__' }],
  sort: [{ field: 'updated_at', direction: 'asc' }],
})
```

## Current Mutating Paths

### Manual commitment create

Source:
`life-cc/src/Dashboard.tsx`

Function:
`create_manual_commitment`

### Status updates

Source:
`life-cc/src/CommitmentItem.tsx`

Function:
`update_commitment_status`

Statuses used by the UI:

- `done`
- `snoozed`
- `open` for unsnooze

### Manual extraction

Source:
`life-cc/src/SyncButton.tsx`

Function:
`run_extraction`

Expected backend side effects:

- initialize one `sync_progress` row per configured source
- move each row to a terminal state
- write any new `commitments`

### Gmail reply flow

Source:
`life-cc/src/actions/ReplyPanel.tsx`

Sequence:

1. `suggest_gmail_reply`
2. `reply-suggestion-agent`
3. `create_gmail_draft`

LLM boundary:

- only step 2 is agent-driven
- step 1 is the context-reduction guardrail
- step 3 is deterministic and side-effecting

### Calendar edit

Source:
`life-cc/src/actions/EditEventForm.tsx`

Function:
`edit_calendar_event`

### Document preview

Source:
`life-cc/src/actions/DocViewer.tsx`

Function:
`preview_document`

LLM usage:

- none

## Removed From Intended Live Flow

These older paths are no longer the intended contract in the checked-in design:

- direct dashboard writes to the `commitments` table
- direct `useUpdateRecord` status mutations
- `action-agent` as the execution path for reply draft, calendar edit, or document preview
- `assistant-agent` as a mutating product surface
- default-on Ask AI network calls for simple queue questions
