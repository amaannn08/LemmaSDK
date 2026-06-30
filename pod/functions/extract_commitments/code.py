#input_type_name: ExtractInput
#output_type_name: ExtractResult
#function_name: extract_commitments

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

CONNECTOR_ALIASES = {
    "gmail": ["gmail", "my-gmail"],
    "google_calendar": ["google_calendar", "my-calendar"],
    "google_drive": ["google_drive", "my-drive"],
}

DEADLINE_KW = re.compile(
    r"\b(due|deadline|payment|invoice|pay|rsvp|expir\w*|renew|submit|reminder|"
    r"overdue|last date|action required|sign|approve|confirm by)\b",
    re.I,
)
URGENT_KW = re.compile(r"\b(urgent|asap|immediately|today|eod|end of day)\b", re.I)
SKIP_LABELS = {"DRAFT", "SENT", "TRASH", "SPAM"}
MEDIA_PREFIXES = ("video/", "image/", "audio/")
DOC_MIME = "application/vnd.google-apps.document"
SHEET_MIMES = (
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
)
NOT_CONNECTED_MARKERS = (
    "not connected",
    "no connected",
    "account resolution",
    "resolve account",
    "reauth",
    "auth",
    "credential",
)
GMAIL_LOOKBACK_QUERY = "newer_than:2d -category:promotions -category:social -in:sent -in:draft"
CALENDAR_LOOKAHEAD_DAYS = 7
DRIVE_LOOKBACK_DAYS = 14


def clip(value: Any, limit: int) -> str:
    return str(value or "").strip()[:limit]


def connector_result(response: Any) -> dict[str, Any]:
    payload = response.to_dict() if hasattr(response, "to_dict") else response
    if isinstance(payload, dict) and "result" in payload:
        return payload.get("result") or {}
    return payload or {}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _email_metadata(message: dict[str, Any]) -> dict[str, Any]:
    preview = message.get("preview") or {}
    return {
        "subject": clip(message.get("subject") or preview.get("subject") or "(no subject)", 120),
        "from":    clip(message.get("sender") or "", 80),
        "date":    clip(message.get("date") or "", 20),
        "snippet": clip(preview.get("body") or message.get("messageText") or "", 200),
    }


def _parse_agent_decisions(stdout: str) -> dict[int, dict]:
    # ponytail: --output json emits pretty-printed multi-line objects; raw_decode scans all of them
    decoder = json.JSONDecoder()
    decisions: dict[int, dict] = {}
    pos = 0
    while pos < len(stdout):
        rest = stdout[pos:]
        stripped = rest.lstrip()
        if not stripped:
            break
        try:
            event, length = decoder.raw_decode(stripped)
            pos += (len(rest) - len(stripped)) + length
            data = event.get("data") or {}
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except Exception:
                    continue
            output = data.get("output_data") or (data.get("tool_args") or {}).get("output") or (data.get("tool_result") or {}).get("output") or {}
            for d in output.get("decisions") or []:
                decisions[d["index"]] = d
        except json.JSONDecodeError:
            pos += 1
    return decisions


def _classify_emails_llm(messages: list[dict[str, Any]]) -> list[dict[str, Any] | None]:
    if not messages:
        return []
    batch = [{"index": i, **_email_metadata(m)} for i, m in enumerate(messages)]
    try:
        proc = subprocess.run(
            ["lemma", "--output", "json", "agents", "run", "email-classifier", json.dumps(batch)],
            capture_output=True, text=True, timeout=90,
        )
        decisions = _parse_agent_decisions(proc.stdout)
        results: list[dict[str, Any] | None] = []
        for i, msg in enumerate(messages):
            d = decisions.get(i)
            if not d or not d.get("is_commitment"):
                results.append(None)
                continue
            results.append({
                "source_app": "gmail",
                "source_ref": msg.get("messageId"),
                "title":       clip(d.get("title") or "", 240),
                "description": clip(d.get("description") or "", 480) or None,
                "due_date":    d.get("due_date") or None,
                "category":    d.get("category") or "followup",
                "priority":    d.get("priority") or "normal",
            })
        return results
    except Exception:
        return [None] * len(messages)


def classify_email(message: dict[str, Any], me: str = "") -> dict[str, Any] | None:
    # ponytail: unused for Gmail (replaced by _classify_emails_llm batch path)
    if set(message.get("labelIds") or []) & SKIP_LABELS:
        return None
    preview = message.get("preview") or {}
    subject = message.get("subject") or preview.get("subject") or "(no subject)"
    body = preview.get("body") or message.get("messageText") or ""
    text = f"{subject} {body}"
    category = "deadline" if DEADLINE_KW.search(text) else "followup"
    priority = "high" if (URGENT_KW.search(text) or category == "deadline") else "normal"
    return {
        "source_app": "gmail",
        "source_ref": message.get("messageId"),
        "title": clip(subject, 240),
        "description": clip(body, 480) or None,
        "due_date": None,
        "category": category,
        "priority": priority,
    }


def classify_event(event: dict[str, Any], me: str = "") -> dict[str, Any] | None:
    if event.get("status") == "cancelled":
        return None
    start = event.get("start") or {}
    due_date = start.get("date") or (start.get("dateTime") or "")[:10] or None
    recurring_id = event.get("recurringEventId")
    # ponytail: use series ID for recurring events so the dedup key is stable across
    # every daily instance — prevents a new row per occurrence.
    source_ref = recurring_id if recurring_id else event.get("id")
    category = "recurring" if recurring_id else "deadline"
    return {
        "source_app": "google_calendar",
        "source_ref": source_ref,
        "title": clip(event.get("summary") or "(busy)", 240),
        "description": clip(event.get("location"), 480) or None,
        "due_date": due_date,
        "category": category,
        "priority": "normal",
    }


def classify_file(file_data: dict[str, Any], me: str = "") -> dict[str, Any] | None:
    mime = file_data.get("mimeType") or ""
    if mime.startswith(MEDIA_PREFIXES) or "folder" in mime:
        return None
    if mime == DOC_MIME:
        source_app = "google_docs"
    elif mime in SHEET_MIMES:
        source_app = "google_sheets"
    else:
        source_app = "google_drive"
    return {
        "source_app": source_app,
        "source_ref": file_data.get("id"),
        "title": clip(file_data.get("name") or "(file)", 240),
        "description": None,
        "due_date": None,
        "category": "document",
        "priority": "low",
    }


def _fetch_message_metadata(pod: Pod, msg_id: str) -> dict[str, Any] | None:
    try:
        result = connector_result(execute_connector(
            pod, "gmail", "messages_get",
            {"user_id": "me", "id": msg_id, "format": "metadata",
             "metadata_headers": ["Subject", "From", "Date", "Message-ID"]},
        ))
        headers = (result.get("payload") or {}).get("headers") or []
        header_map = {h.get("name", "").lower(): h.get("value", "") for h in headers}
        return {
            "messageId": result.get("id") or msg_id,
            "subject":   header_map.get("subject", "(no subject)"),
            "sender":    header_map.get("from", ""),
            "date":      header_map.get("date", ""),
            "labelIds":  result.get("labelIds") or [],
            "preview":   {"body": result.get("snippet") or ""},
        }
    except Exception:
        return None


def fetch_gmail(pod: Pod) -> list[dict[str, Any]]:
    # ponytail: GMAIL_FETCH_EMAILS doesn't exist in LEMMA connector; use list+get pattern
    list_result = connector_result(execute_connector(
        pod, "gmail", "messages_list",
        {"user_id": "me", "q": GMAIL_LOOKBACK_QUERY, "max_results": 20},
    ))
    ids = [m.get("id") for m in (list_result.get("messages") or []) if m.get("id")]
    messages = []
    for msg_id in ids:
        msg = _fetch_message_metadata(pod, msg_id)
        if msg:
            messages.append(msg)
    return messages


def fetch_calendar(pod: Pod) -> list[dict[str, Any]]:
    now = now_utc()
    result = connector_result(execute_connector_candidates(
        pod,
        "google_calendar",
        [
            (
                "GOOGLECALENDAR_EVENTS_LIST",
                [
                    {
                        "calendarId": "primary",
                        "singleEvents": True,
                        "orderBy": "startTime",
                        "timeMin": now.isoformat(),
                        "timeMax": (now + timedelta(days=CALENDAR_LOOKAHEAD_DAYS)).isoformat(),
                        "maxResults": 20,
                    }
                ],
            ),
            (
                "events_list",
                [
                    {
                        "calendar_id": "primary",
                        "single_events": True,
                        "order_by": "startTime",
                        "time_min": now.isoformat(),
                        "time_max": (now + timedelta(days=CALENDAR_LOOKAHEAD_DAYS)).isoformat(),
                        "max_results": 20,
                    }
                ],
            ),
        ],
    ))
    return result.get("items") or []


def fetch_drive(pod: Pod) -> list[dict[str, Any]]:
    since = (now_utc() - timedelta(days=DRIVE_LOOKBACK_DAYS)).strftime("%Y-%m-%dT%H:%M:%S")
    query = (
        "trashed = false and mimeType != 'application/vnd.google-apps.folder' "
        f"and modifiedTime > '{since}'"
    )
    result = connector_result(execute_connector_candidates(
        pod,
        "google_drive",
        [
            ("GOOGLEDRIVE_FIND_FILE", [{"q": query, "orderBy": "modifiedTime desc", "pageSize": 20}]),
            ("files_list", [{"q": query, "order_by": "modifiedTime desc", "page_size": 20}]),
        ],
    ))
    return result.get("files") or []


SOURCE_CONFIGS = [
    ("gmail", fetch_gmail, classify_email),
    ("google_calendar", fetch_calendar, classify_event),
    ("google_drive", fetch_drive, classify_file),
]


def configured_sources() -> list[str]:
    return [source_app for source_app, _, _ in SOURCE_CONFIGS]


def execute_connector(pod: Pod, connector: str, operation: str, payload: dict[str, Any]):
    last_error: Exception | None = None
    for connector_name in CONNECTOR_ALIASES.get(connector, [connector]):
        try:
            return pod.connectors.execute(connector_name, operation, payload)
        except Exception as error:
            try:
                completed = subprocess.run(
                    [
                        "lemma",
                        "--output",
                        "json",
                        "connectors",
                        "operations",
                        "execute",
                        connector_name,
                        operation,
                        "--data",
                        json.dumps({"payload": payload}),
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                )
                return json.loads(completed.stdout)
            except Exception:
                last_error = error
    if last_error:
        raise last_error
    raise RuntimeError(f"No connector aliases configured for {connector}")


def execute_connector_candidates(
    pod: Pod, connector: str, candidates: list[tuple[str, list[dict[str, Any]]]]
):
    last_error: Exception | None = None
    for operation, payloads in candidates:
        for payload in payloads:
            try:
                return execute_connector(pod, connector, operation, payload)
            except Exception as error:
                last_error = error
    if last_error:
        raise last_error
    raise RuntimeError(f"No connector candidates configured for {connector}")


def is_not_connected_error(error_text: str) -> bool:
    text = (error_text or "").lower()
    return any(marker in text for marker in NOT_CONNECTED_MARKERS)


def summarize_categories(category_counts: dict[str, int], sample_title: str | None) -> str:
    parts = [f"{count} {category}{'s' if count > 1 else ''}" for category, count in category_counts.items()]
    summary = ", ".join(parts) if parts else "nothing new"
    if sample_title:
        summary = f"{summary} · {sample_title}"
    return clip(summary, 240)


def to_commitment_row(normalized: dict[str, Any], now_iso: str) -> dict[str, Any]:
    return {
        "title": normalized["title"],
        "description": normalized.get("description"),
        "source_app": normalized["source_app"],
        "source_ref": normalized["source_ref"],
        "dedup_key": f"{normalized['source_app']}:{normalized['source_ref']}",
        "due_date": normalized.get("due_date"),
        "status": "open",
        "priority": normalized.get("priority") or "normal",
        "category": normalized["category"],
        "detected_at": now_iso,
    }


def duplicate_error(error: Exception) -> bool:
    text = str(error).lower()
    return "unique" in text or "duplicate" in text or "dedup_key" in text or "conflict" in text


def ensure_progress_rows(pod: Pod, run_id: str) -> dict[str, str]:
    table = pod.table("sync_progress")
    existing_rows = pod.records.list(
        "sync_progress",
        limit=max(10, len(SOURCE_CONFIGS) * 2),
        filter=[{"field": "sync_run_id", "op": "eq", "value": run_id}],
        sort=[{"field": "created_at", "direction": "asc"}],
    ).to_dict()["items"]
    row_ids = {row["source_app"]: row["id"] for row in existing_rows if row.get("source_app")}
    for source_app in configured_sources():
        if source_app in row_ids:
            continue
        row_ids[source_app] = table.create(
            {
                "sync_run_id": run_id,
                "source_app": source_app,
                "status": "pending",
                "items_seen": 0,
                "items_written": 0,
            }
        )["id"]
    return row_ids


def update_progress_row(
    pod: Pod,
    row_id: str | None,
    *,
    status: str,
    items_seen: int,
    items_written: int,
    category_summary: str | None = None,
    error_message: str | None = None,
) -> None:
    if not row_id:
        return
    payload = {
        "status": status,
        "items_seen": items_seen,
        "items_written": items_written,
        "category_summary": category_summary,
        "error_message": error_message,
    }
    pod.table("sync_progress").update(row_id, payload)


def run_extraction_sweep(pod: Pod, user_email: str = "", run_id: str | None = None) -> dict[str, Any]:
    progress_rows = ensure_progress_rows(pod, run_id) if run_id else {}
    sources_summary: dict[str, dict[str, Any]] = {}
    total_seen = 0
    total_written = 0
    me = (user_email or "").lower()

    for source_app, fetch, classify in SOURCE_CONFIGS:
        row_id = progress_rows.get(source_app)
        if row_id:
            update_progress_row(
                pod,
                row_id,
                status="running",
                items_seen=0,
                items_written=0,
                category_summary=None,
                error_message=None,
            )
        seen = 0
        written = 0
        sample_title: str | None = None
        category_counts: dict[str, int] = {}
        try:
            items = fetch(pod)
            seen = len(items)
            total_seen += seen
            now_iso = now_utc().isoformat()
            seen_keys: set[str] = set()
            if source_app == "gmail":
                eligible = [m for m in items if not (set(m.get("labelIds") or []) & SKIP_LABELS)]
                normalized_list = _classify_emails_llm(eligible)
                pairs: list[tuple[dict, dict | None]] = list(zip(eligible, normalized_list))
            else:
                pairs = [(item, classify(item, me)) for item in items]
            for item, normalized in pairs:
                if not normalized or not normalized.get("source_ref"):
                    continue
                dedup_key = f"{normalized['source_app']}:{normalized['source_ref']}"
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)
                try:
                    pod.table("commitments").create(to_commitment_row(normalized, now_iso))
                    written += 1
                    total_written += 1
                    category = normalized["category"]
                    category_counts[category] = category_counts.get(category, 0) + 1
                    sample_title = sample_title or normalized["title"]
                except Exception as row_error:
                    if duplicate_error(row_error):
                        continue
                    raise
            update_progress_row(
                pod,
                row_id,
                status="done",
                items_seen=seen,
                items_written=written,
                category_summary=summarize_categories(category_counts, sample_title),
                error_message=None,
            )
            sources_summary[source_app] = {"seen": seen, "written": written, "status": "done"}
        except Exception as error:
            error_text = clip(error, 240)
            if duplicate_error(error):
                update_progress_row(
                    pod,
                    row_id,
                    status="done",
                    items_seen=seen,
                    items_written=written,
                    category_summary=summarize_categories(category_counts, sample_title),
                    error_message=None,
                )
                sources_summary[source_app] = {"seen": seen, "written": written, "status": "done"}
            elif is_not_connected_error(error_text):
                update_progress_row(
                    pod,
                    row_id,
                    status="skipped",
                    items_seen=seen,
                    items_written=written,
                    category_summary="Not connected",
                    error_message=None,
                )
                sources_summary[source_app] = {
                    "seen": seen,
                    "written": written,
                    "status": "skipped",
                }
            else:
                update_progress_row(
                    pod,
                    row_id,
                    status="failed",
                    items_seen=seen,
                    items_written=written,
                    category_summary=None,
                    error_message=error_text,
                )
                sources_summary[source_app] = {
                    "seen": seen,
                    "written": written,
                    "status": "failed",
                    "error_message": error_text,
                }

    return {
        "items_seen": total_seen,
        "items_written": total_written,
        "sources": sources_summary,
        "configured_sources": configured_sources(),
    }


class ExtractInput(BaseModel):
    sync_run_id: str | None = None


class ExtractResult(BaseModel):
    items_seen: int
    items_written: int
    sources: dict
    configured_sources: list[str]


async def extract_commitments(ctx: FunctionContext, data: ExtractInput) -> ExtractResult:
    pod = Pod.from_env()
    result = run_extraction_sweep(pod, user_email=ctx.user_email or "", run_id=data.sync_run_id)
    return ExtractResult(**result)


if __name__ == "__main__":
    assert classify_email(
        {"messageId": "1", "sender": "a@x.com", "preview": {"subject": "hey you up?", "body": "ping"}}
    )["category"] == "followup"
    assert classify_email(
        {"messageId": "2", "sender": "a@x.com", "preview": {"subject": "Invoice due Friday", "body": "pay"}}
    )["category"] == "deadline"
    assert classify_email({"messageId": "3", "sender": "me@x.com", "labelIds": ["DRAFT"]}, me="me@x.com") is None
    assert classify_event(
        {"id": "e1", "summary": "Standup", "recurringEventId": "r1", "start": {"date": "2026-07-01"}}
    )["category"] == "recurring"
    assert classify_event({"id": "e2", "summary": "Dentist", "start": {"dateTime": "2026-07-02T10:00:00Z"}})[
        "due_date"
    ] == "2026-07-02"
    assert classify_file({"id": "f1", "name": "Q3.xlsx", "mimeType": SHEET_MIMES[1]})["source_app"] == "google_sheets"
    assert classify_file({"id": "f2", "name": "clip.mp4", "mimeType": "video/mp4"}) is None
    print("ok")
