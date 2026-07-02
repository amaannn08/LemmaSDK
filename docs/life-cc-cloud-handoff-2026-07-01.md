# Life Command Centre Cloud Handoff

Date: 2026-07-01

## Done

- Local frontend fixed:
  - dashboard top bar removed on `/dashboard`
  - single visible `Check now`
  - single visible date nav cluster
  - `Check now` still uses `run_extraction({ sync_run_id })`
- Local pod re-imported successfully after removing the broken local-only Gmail trigger schedule bundle entry.
- Canonical local app `life-command-centre` deployed and verified.
- Local stale app `life-cc` deleted.
- `write_briefing` fixed to safely upsert the daily briefing row; local `briefing-refresh` now passes.

## Important Cloud Facts

- The real public submission URL is:
  - `https://life-cc.apps.lemma.work/dashboard`
- The cloud server is `default`:
  - `https://api.lemma.work`
- The cloud app currently serving that URL is:
  - app name: `life-cc`
  - app id: `019f0e2c-d28a-75de-a3b4-c56883d2bcc1`
  - pod id: `019f0a7f-8d9e-7349-a98a-fce12b400976`
  - app URL: `https://life-cc.apps.lemma.work`
- `https://life-command-centre.apps.lemma.work/dashboard` returned `404` during verification.
- The local pod/app work already completed does **not** automatically update the cloud `lemma.work` app, because local and cloud are different Lemma servers.

## Left To Do

1. Switch CLI context to cloud explicitly for all remaining commands:
   - use `lemma --server default ...`
2. Inspect the cloud pod `019f0a7f-8d9e-7349-a98a-fce12b400976` before deploy:
   - `lemma --server default pods list`
   - `lemma --server default apps get life-cc --full`
   - `lemma --server default functions list --pod 019f0a7f-8d9e-7349-a98a-fce12b400976`
   - verify whether cloud still lacks `run_extraction` / `sync_progress` parity
3. Deploy the current frontend build to the existing cloud app slot `life-cc` so the public URL stays the same:
   - from `life-cc/`
   - likely target command path is `lemma --server default apps deploy life-cc . --yes`
4. If cloud pod resources are stale, import the hardened `pod/` bundle to the cloud pod too:
   - dry run first
   - then real import against cloud
5. Re-test the real public URL:
   - verify dashboard has no duplicate top bar
   - verify only one `Check now`
   - verify date nav still works
   - verify built JS contains `run_extraction` and `sync_progress`
6. Re-run cloud smoke:
   - `run_extraction`
   - `sync_progress`
   - `briefing-refresh`

## Safest Next Goal

Do **not** rename the public cloud app right now.

The safest submission path is:

- keep public URL as `life-cc.apps.lemma.work`
- deploy the fixed frontend into that existing cloud app slot
- only consider slug/app-name cleanup after submission

