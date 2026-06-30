# Life Command Centre — pod runbook

Personal "life briefing" pod: sweeps Google services, extracts **commitments**
(deadlines / follow-ups / documents / recurring / loops) into the `commitments`
table, and surfaces them in the `life-cc` app with a daily briefing.

## Architecture (post-rearchitecture)

```
Manual "Check now" ─────► run_extraction (JOB, sync_run_id) ─► commitments + sync_progress
*/2 TIME extraction-sweep ► extraction-run (workflow) ───────► run_extraction
new Gmail (webhook) ──────► gmail-intake (workflow) ─────────► run_extraction
                                                               │ (live)
                                                               ▼
manual refresh / opt-in auto refresh ► briefing-refresh (workflow)
                                       gather_briefing_data -> decision -> briefing-agent
                                       -> write_briefing -> briefing table
                                       app reads commitments + briefing live
```

- **Extraction is deterministic**. `run_extraction` initializes truthful
  `sync_progress` rows for every configured source, then calls the shared
  extraction engine. The engine uses the DB `dedup_key` uniqueness guarantee as
  the safety boundary so overlapping runs do not create duplicate commitments.
- **Briefing**: `briefing-agent` is read-only and returns `{regenerate, content}`
  (output_schema); `write_briefing` persists it. `gather_briefing_data` prepares
  a capped structured payload (max 25 items across urgency buckets) and the
  workflow skips the agent entirely when nothing changed since the last briefing.
- **Mutating UI actions are typed functions**: `create_manual_commitment`,
  `update_commitment_status`, `create_gmail_draft`, `edit_calendar_event`,
  `preview_document`, plus a reduced-context Gmail suggestion path using
  `suggest_gmail_reply` + `reply-suggestion-agent`.
- **Why split judge/write?** This cloud runtime stringifies agent tool-call object
  args, so **agent table-writes fail**. Functions write reliably via the SDK, so
  every durable write is a function; agents only read + return structured output.

## Non-bundled cloud setup (already done in this org)

- Connector auth-configs + connected accounts: `gmail`, `google_calendar`,
  `google_drive` (+ others) — `lemma connectors accounts list`.
- Agent runtime: cloud profile is `system:lemma`. briefing-agent uses
  `deepseek-v4-pro`; others `minimax-m3`. (The local `deepseek-chat` profile id does
  **not** exist in cloud — that was the env-split failure.)

## Operating the schedules (COST CONTROL)

Repo manifests are the default truth. In this checkout the schedules are not
assumed active unless deployment explicitly enables them.

| schedule | cadence | cost |
| --- | --- | --- |
| `extraction-sweep` | `*/2` | cheap (deterministic, deduped) |
| `briefing-refresh` | `*/5` | gated; only reaches the LLM when commitments changed |
| `gmail-trigger` | webhook | per inbound email → deterministic sweep (zero LLM) |

The frontend also keeps briefing auto-refresh opt-in at runtime via
`VITE_ENABLE_BRIEFING_AUTO_REFRESH=true`.

Pause schedules when not demoing to protect the quota:

```bash
lemma schedules pause briefing-refresh
lemma schedules pause extraction-sweep
lemma schedules resume <name>   # before a demo
```
## Verify end-to-end

```bash
# extraction
lemma functions run run_extraction --data '{"sync_run_id":"smoke"}'
lemma records list commitments --limit 5
lemma records list sync_progress --limit 5         # per-connector insight text/status

# briefing
lemma workflows run briefing-refresh
lemma records list briefing --limit 1

# schedules fired
lemma schedules get extraction-sweep                # last_fire_status = TRIGGERED
lemma schedules get briefing-refresh

# gmail webhook: send a test email to the connected account, then:
lemma schedules get gmail-trigger                   # last_fired_at populated
lemma records list commitments --limit 3            # the new mail as a commitment
```

App: `cd life-cc && npm run dev` (or `npm run build`). "Check now" streams
per-connector insights, including `failed` vs `skipped/not connected`. The open
queue is capped intentionally and the UI tells you when counts are partial.

## Known limitations

- `assistant-agent` is intentionally read-only during the rollout. Telegram is
  intentionally disabled until the function-backed action path is verified there too.
- Webhook delivery needs the cloud backend reachable (it is). Local stacks won't
  receive webhook POSTs — use `extraction-sweep` there.
- Extra connectors (googletasks, calendly, notion) need the `commitments.source_app`
  / `sync_progress.source_app` enums extended first, then an adapter entry in the
  extraction engine + a webhook workflow.
