# Life Command Centre — setup notes

Personal tool, single user. Built as a Lemma pod + this app. Connector set is
**native LEMMA only — no Composio anywhere in this stack.**

## Environment

- Local Lemma stack (`lemma-stack`), not hosted `lemma.work` — chosen so
  Gmail/Drive/Calendar/Docs content stays on this machine.
- CLI server profile: `local` (`lemma --server local ...` for every command
  below — the CLI's `active_server` defaults to `default`, which is a separate
  hosted account, so don't drop `--server local`).
- Org: `Team 7` (`019f053d-3a39-76aa-9aac-0668f4bae57d`)
- Pod: `life-command-centre` (`019f0543-0b12-707b-bec0-e9896e3fca54`)

## One-off local-stack fix already applied

The backend container runs as `uid 999` (`appuser`); host-mounted data dirs
under `~/.lemma/local/data/` were created owned by the host user with no
write access for "other", so any pod-related call 500'd
(`PermissionError` creating `/app/.local/workspaces/public-icons`). Fixed with:

```bash
chmod -R o+rwX ~/.lemma/local/data
lemma-stack restart
```

If this stack is ever reinstalled/reset, redo this before anything else.

## Connector catalog

This Lemma release's native catalog is exactly: `gmail`, `google_calendar`,
`google_drive`, `google_docs`, `google_sheets`, `jira`, `slack`. No native
Notion connector exists (Notion is Composio-only here) — dropped from scope
rather than bring in Composio for one service.

Seeded into the catalog (one-time, this script's filename mentions Composio
but `--provider native` imports native apps only, no `COMPOSIO_API_KEY` is
set so the Composio half is a no-op):

```bash
docker exec lemma-local-backend python /app/scripts/import_composio_catalog.py \
  --provider native --app gmail --app google_calendar --app google_drive \
  --app google_docs --app google_sheets --app jira --app slack
lemma --server local connectors list   # confirm all 7
```

## OAuth credentials needed (system-default, via env)

Each connector's OAuth client is configured via `lemma-stack config set ...`
then `lemma-stack restart`. **Redirect URI for all of them**:
`https://127-0-0-1.sslip.io:8712/connectors/connect-requests/oauth/callback`

Google (and most OAuth providers) reject `http://` redirect URIs for any host
other than literal `localhost` — `127-0-0-1.sslip.io` doesn't qualify even
though it resolves to loopback. Since the local backend only serves plain
HTTP on :8711, a local self-signed HTTPS proxy was added in front of it:

```bash
mkdir -p ~/.lemma/local/https-proxy && cd ~/.lemma/local/https-proxy
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 825 -nodes \
  -subj "/CN=127-0-0-1.sslip.io" \
  -addext "subjectAltName=DNS:127-0-0-1.sslip.io,IP:127.0.0.1"
# nginx.conf: listens 8712 ssl, proxy_pass http://lemma-local-backend:8000
docker run -d --name lemma-local-https-proxy --network lemma-local-net \
  -p 127.0.0.1:8712:8712 \
  -v ~/.lemma/local/https-proxy/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v ~/.lemma/local/https-proxy/cert.pem:/certs/cert.pem:ro \
  -v ~/.lemma/local/https-proxy/key.pem:/certs/key.pem:ro \
  nginx:alpine

# Backend now generates redirect/callback URLs via the HTTPS proxy port, while
# the CLI keeps talking to the backend directly over plain HTTP (separate
# setting — exactly the split the backend config anticipates: "Local dev can
# keep this on HTTP while browser/OAuth URLs use HTTPS"):
lemma-stack config set API_URL "https://127-0-0-1.sslip.io:8712"
lemma-stack config set CLI_API_URL "http://127-0-0-1.sslip.io:8711"
lemma-stack restart
```

The cert is self-signed (no mkcert/local CA trust installed) — the browser
will show a one-time warning on first hit of `https://127-0-0-1.sslip.io:8712`
that needs "Proceed anyway" / "Accept the risk", same as any self-signed local
dev cert. This proxy container is **not** managed by `lemma-stack` — it won't
restart automatically with `lemma-stack restart`/`start`; restart it manually
(`docker start lemma-local-https-proxy`) if the machine reboots.

**Two more fixes were needed for the actual token exchange to succeed** (the
authorize step alone wasn't enough — `redirect_uri_mismatch` showed up a
second time, at a different stage, for different reasons):

1. **`nginx.conf` must use `proxy_set_header Host $http_host;`, not `$host`.**
   nginx's `$host` variable silently strips the port — the backend
   reconstructed its callback URL as `http://127-0-0-1.sslip.io/...` with
   *no port at all*, which obviously didn't match the registered redirect URI.
2. **uvicorn doesn't trust `X-Forwarded-Proto` from the proxy by default**,
   so even with the port fixed, the backend still saw the connection as plain
   `http` (uvicorn's proxy-header trust defaults to peer IP `127.0.0.1`
   only — the nginx container's docker-network IP, or even the docker bridge
   gateway IP when nginx runs with `--network host`, neither qualifies).
   Fixed via an env var uvicorn reads directly (no CMD override needed):
   ```bash
   lemma-stack config set FORWARDED_ALLOW_IPS "*"
   lemma-stack restart
   ```

Without both fixes, the authorize redirect to Google looks correct and the
consent screen works, but the backend's subsequent server-to-server token
exchange call to Google fails with `redirect_uri_mismatch` because the
self-reconstructed callback URL (`http://...`, no port) doesn't match what's
registered on the Google OAuth client (`https://...:8712`). Confirmed fixed:
Gmail shows `CONNECTED` in `lemma connectors overview` after a real OAuth
round-trip through the app.

| Connector(s) | Env vars | Where to get them |
| --- | --- | --- |
| gmail, google_calendar, google_drive, google_docs, google_sheets | `CONNECTOR_GOOGLE_CLIENT_ID`, `CONNECTOR_GOOGLE_CLIENT_SECRET` | GCP project `lemma-life-cc` (created via `gcloud projects create lemma-life-cc`; APIs enabled via `gcloud services enable gmail.googleapis.com calendar-json.googleapis.com drive.googleapis.com docs.googleapis.com sheets.googleapis.com`). OAuth consent screen + Client ID **must be created via Cloud Console UI** — `gcloud iap oauth-brands` is shut down (deprecated, fully non-functional since 2026-03-19). Console: APIs & Services → OAuth consent screen (External, add yourself as test user) → Credentials → Create Credentials → OAuth client ID → Web application → add the redirect URI above. |
| slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | api.slack.com/apps → Create New App → **From an app manifest** (much faster than the scope-by-scope UI — paste a manifest with `oauth_config.redirect_urls` = the URI above and `oauth_config.scopes.bot`/`.user` matching what's in `lemma_apps_config.json`'s `slack` entry inside the backend image: `docker exec lemma-local-backend python -c "import json; print(json.load(open('/app/scripts/lemma_apps_config.json')))"` and find the `slack` app). Then Basic Information page → Client ID + Secret. |
| jira | not configured (deferred — not used personally) | `JIRA_CLIENT_ID`/`JIRA_CLIENT_SECRET` via an Atlassian developer console OAuth app, if revisited later |

```bash
lemma-stack config set CONNECTOR_GOOGLE_CLIENT_ID <id>
lemma-stack config set CONNECTOR_GOOGLE_CLIENT_SECRET <secret>
lemma-stack config set SLACK_CLIENT_ID <id>
lemma-stack config set SLACK_CLIENT_SECRET <secret>
lemma-stack restart
```

## Auth configs (one per connector, run once credentials above are set)

```bash
lemma --server local connectors auth-configs create gmail --name my-gmail --provider LEMMA
lemma --server local connectors auth-configs create google_calendar --name my-calendar --provider LEMMA
lemma --server local connectors auth-configs create google_drive --name my-drive --provider LEMMA
lemma --server local connectors auth-configs create google_docs --name my-docs --provider LEMMA
lemma --server local connectors auth-configs create google_sheets --name my-sheets --provider LEMMA
lemma --server local connectors auth-configs create slack --name my-slack --provider LEMMA
lemma --server local connectors overview   # confirm ACTIVE under LEMMA
```

Auth configs are runtime state and do **not** round-trip through pod bundle
import/export — if this pod is ever re-imported elsewhere, redo this section.

## The app

`npm run dev` (auto-authed via the CLI token, dev-only). Connections screen
(`src/ConnectionsScreen.tsx`) lists all 7 catalog connectors, shows
connected/needs-reconnect/not-connected per `AccountStatus`
(`CONNECTED`/`REAUTH_REQUIRED`/`DISCONNECTED`), and re-lists accounts on every
mount — which is also how it picks up a just-completed OAuth redirect (full
page reload, not a popup) and catches a token revoked since the last visit.

`organizationId` is fetched once via `lemmaClient.pods.get(podId).organization_id`
— not hardcoded — since the app only knows its `podId` from `.env.local`.

## The brain — `pod/` bundle

A separate bundle dir, `/home/amann/lemma/pod/`, holds the extraction agent.
Import with `lemma --server local pods import ./pod`.

- **Table** `commitments` (RLS-on) — one row per real deadline/follow-up/
  document the agent finds. Columns: `title`, `description`, `source_app`
  (enum, the 5 Google connector ids), `source_ref`, `due_date`, `status`
  (`open`/`done`/`snoozed`), `priority` (`low`/`normal`/`high`), `detected_at`.
- **Agent** `extraction-agent` — grants: `commitments` read/write +
  `connector.use` on the 5 Google connectors.
- **Schedule** `extraction-sweep` — TIME cron, every 30 minutes, runs the
  agent. (Not WEBHOOK: native LEMMA connectors expose zero triggers in this
  installed release — `lemma connectors triggers list <auth-config>` returns
  empty for all 5.)

**LLM key** (DeepSeek, OpenAI-compatible):
```bash
lemma-stack config set LEMMA_DEFAULT_MODEL_TYPE openai_compat
lemma-stack config set LEMMA_OPENAI_BASE_URL https://api.deepseek.com
lemma-stack config set LEMMA_OPENAI_DEFAULT_MODEL deepseek-chat
lemma-stack config set LEMMA_OPENAI_MODEL_NAMES deepseek-chat,deepseek-reasoner
lemma-stack restart
```

**Connector-tools platform gap (important).** `agents.md` documents "Agents
granted the connector get an operation toolset automatically" — **this is not
true in this installed Lemma 0.5.2 release.** Confirmed by reading the backend
source (`app/modules/agent/tools/registry.py`'s `AgentToolset`/
`_TOOLSET_BY_NAME` has no connector entry; `pod_toolset` has zero connector
code; the only `connector_info_toolset` in
`app/modules/agent/tools/connectors/connectors.py` is never wired into any
agent's runtime toolset, only used by an internal schema-export script). The
working fix: give the agent the **`WORKSPACE_CLI`** toolset too (a real shell
running the `lemma` CLI as the delegated user) and tell it, in
`instruction.md`, to call `lemma connectors operations search/get/execute
<auth-config-name> ...` itself — auth-config names: `my-gmail`, `my-calendar`,
`my-drive`, `my-docs`, `my-sheets`. Verified end-to-end: a real chat run
scanned 30 Gmail messages and wrote 2 real rows to `commitments`, correctly
skipping 28 as noise. If a future Lemma release adds real POD-level connector
tools, this is the first thing to revisit (drop `WORKSPACE_CLI`, narrow the
agent back to `POD` only).

## Dashboard

`src/Dashboard.tsx` shows open `commitments` rows live via `lemma-sdk/react`'s
`useLiveRecords` (websocket merge, no polling) and lets you mark a row
done/snoozed via a per-row `useUpdateRecord`. Needs the `pod/` bundle imported
and at least one connector connected with real mail/events/files to show
anything (currently: Gmail only).

## Still out of scope (future work)

- Connect the remaining 4 Google connectors (Calendar/Drive/Docs/Sheets) —
  auth configs exist, no accounts connected yet.
- Slack (`use slack only` for the non-Google addition) — app manifest/OAuth
  credentials not obtained yet.
- Jira (deferred, not used personally).
- Disconnect/reconnect verification pass per the original plan.
- Any WhatsApp/Telegram loop-detection feature (no compliant API for WhatsApp
  personal chats at all; Telegram MTProto would be a custom integration, not
  attempted yet).
