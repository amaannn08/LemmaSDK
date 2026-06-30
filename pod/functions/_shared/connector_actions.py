from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from lemma_sdk import Pod


def clip(value: Any, limit: int) -> str:
    return str(value or "").strip()[:limit]


def get_commitment_record(pod: Pod, commitment_id: str) -> dict[str, Any]:
    items = pod.records.list(
        "commitments",
        limit=1,
        filter=[{"field": "id", "op": "eq", "value": commitment_id}],
    ).to_dict()["items"]
    if not items:
        raise ValueError("commitment not found")
    return items[0]


def connector_result(response: Any) -> dict[str, Any]:
    payload = response.to_dict() if hasattr(response, "to_dict") else response
    if isinstance(payload, dict) and "result" in payload:
        return payload.get("result") or {}
    return payload or {}


def try_connector_operations(
    pod: Pod, connector: str, candidates: list[tuple[str, list[dict[str, Any]]]]
) -> tuple[dict[str, Any], str]:
    last_error: Exception | None = None
    for operation_name, payloads in candidates:
        for payload in payloads:
            try:
                return connector_result(pod.connectors.execute(connector, operation_name, payload)), operation_name
            except Exception as error:  # pragma: no cover - exercised in the live pod
                last_error = error
    if last_error:
        raise last_error
    raise RuntimeError(f"No connector candidates configured for {connector}")


def find_header(message: dict[str, Any], name: str) -> str | None:
    wanted = name.lower()
    for header in (message.get("headers") or []):
        if str(header.get("name") or "").lower() == wanted:
            return header.get("value")
    payload = message.get("payload") or {}
    for header in (payload.get("headers") or []):
        if str(header.get("name") or "").lower() == wanted:
            return header.get("value")
    return None


def message_subject(message: dict[str, Any], fallback_title: str = "") -> str:
    return (
        message.get("subject")
        or (message.get("preview") or {}).get("subject")
        or find_header(message, "subject")
        or fallback_title
        or "(no subject)"
    )


def message_sender(message: dict[str, Any]) -> str:
    return message.get("sender") or find_header(message, "from") or ""


def message_thread_id(message: dict[str, Any]) -> str | None:
    return message.get("threadId") or message.get("thread_id")


def internet_message_id(message: dict[str, Any]) -> str | None:
    return (
        find_header(message, "Message-Id")
        or find_header(message, "Message-ID")
        or message.get("messageId")
        or message.get("id")
    )


def message_excerpt(message: dict[str, Any], limit: int = 1200) -> str:
    preview = message.get("preview") or {}
    text = (
        preview.get("body")
        or message.get("messageText")
        or message.get("snippet")
        or message.get("text")
        or ""
    )
    return clip(text, limit)


def gmail_message_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        (
            "GMAIL_GET_MESSAGE",
            [
                {"message_id": source_ref},
                {"messageId": source_ref},
                {"id": source_ref},
            ],
        ),
        (
            "GMAIL_FETCH_MESSAGE",
            [
                {"message_id": source_ref},
                {"messageId": source_ref},
                {"id": source_ref},
            ],
        ),
        (
            "messages_get",
            [
                {"message_id": source_ref},
                {"messageId": source_ref},
                {"id": source_ref},
                {"payload": {"message_id": source_ref}},
                {"payload": {"messageId": source_ref}},
            ],
        ),
    ]


def gmail_draft_candidates(
    *, thread_id: str | None, subject: str, body: str, reply_to_message_id: str | None, to: str
) -> list[tuple[str, list[dict[str, Any]]]]:
    headers = {"In-Reply-To": reply_to_message_id, "References": reply_to_message_id} if reply_to_message_id else {}
    raw_payload = {
        "threadId": thread_id,
        "to": to,
        "subject": subject if subject.lower().startswith("re:") else f"Re: {subject}",
        "body": body,
        "headers": headers,
    }
    return [
        (
            "GMAIL_CREATE_EMAIL_DRAFT",
            [
                raw_payload,
                {"thread_id": thread_id, "to": to, "subject": raw_payload["subject"], "body": body},
                {"message": raw_payload},
            ],
        ),
        (
            "GMAIL_CREATE_DRAFT",
            [
                raw_payload,
                {"thread_id": thread_id, "to": to, "subject": raw_payload["subject"], "body": body},
            ],
        ),
        (
            "drafts_create",
            [
                raw_payload,
                {"payload": raw_payload},
            ],
        ),
    ]


def calendar_get_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        (
            "GOOGLECALENDAR_GET_EVENT",
            [
                {"calendarId": "primary", "eventId": source_ref},
                {"calendar_id": "primary", "event_id": source_ref},
            ],
        ),
        (
            "GOOGLECALENDAR_EVENTS_GET",
            [
                {"calendarId": "primary", "eventId": source_ref},
                {"calendar_id": "primary", "event_id": source_ref},
            ],
        ),
        (
            "events_get",
            [
                {"calendarId": "primary", "eventId": source_ref},
                {"calendar_id": "primary", "event_id": source_ref},
                {"payload": {"calendarId": "primary", "eventId": source_ref}},
            ],
        ),
    ]


def next_day(date_text: str) -> str:
    return (date.fromisoformat(date_text) + timedelta(days=1)).isoformat()


def calendar_patch_payload(current_event: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    payload = {"calendarId": "primary", "eventId": current_event.get("id"), "sendUpdates": "none"}
    if updates.get("title"):
        payload["summary"] = updates["title"]
    if updates.get("location") is not None:
        payload["location"] = updates["location"]
    if updates.get("description") is not None:
        payload["description"] = updates["description"]
    attendees = updates.get("attendees") or []
    if attendees:
        payload["attendees"] = [{"email": email} for email in attendees]
    due_date = updates.get("due_date")
    if due_date:
        payload["start"] = {"date": due_date}
        payload["end"] = {"date": next_day(due_date)}
    return payload


def calendar_patch_candidates(payload: dict[str, Any]) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        ("GOOGLECALENDAR_UPDATE_EVENT", [payload]),
        ("GOOGLECALENDAR_EVENTS_PATCH", [payload]),
        ("events_patch", [payload, {"payload": payload}]),
    ]


def drive_preview_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        (
            "GOOGLEDRIVE_GET_FILE_CONTENT",
            [
                {"fileId": source_ref},
                {"file_id": source_ref},
                {"id": source_ref},
            ],
        ),
        (
            "GOOGLEDRIVE_GET_FILE",
            [
                {"fileId": source_ref},
                {"file_id": source_ref},
                {"id": source_ref},
            ],
        ),
        ("files_get", [{"fileId": source_ref}, {"id": source_ref}, {"payload": {"id": source_ref}}]),
    ]


def docs_preview_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        ("GOOGLEDOCS_GET_DOCUMENT_BY_ID", [{"documentId": source_ref}, {"id": source_ref}]),
        ("GOOGLEDOCS_GET_DOCUMENT", [{"documentId": source_ref}, {"id": source_ref}]),
        ("documents_get", [{"documentId": source_ref}, {"payload": {"documentId": source_ref}}]),
    ]


def sheets_preview_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        (
            "GOOGLESHEETS_GET_VALUES",
            [
                {"spreadsheetId": source_ref, "range": "A1:Z200"},
                {"spreadsheet_id": source_ref, "range": "A1:Z200"},
            ],
        ),
        (
            "GOOGLESHEETS_GET_SPREADSHEET",
            [
                {"spreadsheetId": source_ref},
                {"spreadsheet_id": source_ref},
                {"id": source_ref},
            ],
        ),
        (
            "spreadsheets_values_get",
            [
                {"spreadsheetId": source_ref, "range": "A1:Z200"},
                {"payload": {"spreadsheetId": source_ref, "range": "A1:Z200"}},
            ],
        ),
    ]


def flatten_doc_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(part for part in (flatten_doc_text(item) for item in value) if part)
    if isinstance(value, dict):
        text_run = value.get("textRun") or value.get("text_run")
        if isinstance(text_run, dict):
            content = text_run.get("content")
            if isinstance(content, str):
                return content
        paragraph = value.get("paragraph")
        if isinstance(paragraph, dict):
            return flatten_doc_text(paragraph.get("elements") or [])
        table = value.get("table")
        if isinstance(table, dict):
            return flatten_doc_text(table.get("tableRows") or [])
        cells = value.get("tableCells") or value.get("cells")
        if cells:
            return flatten_doc_text(cells)
        values = [flatten_doc_text(item) for item in value.values()]
        return "\n".join(part for part in values if part)
    return ""


def format_sheet_values(result: dict[str, Any]) -> str:
    values = result.get("values")
    if not values and result.get("sheets"):
        values = []
        for sheet in result.get("sheets") or []:
            data = (((sheet.get("data") or [{}])[0]).get("rowData") or [])
            for row in data:
                row_values = []
                for cell in row.get("values") or []:
                    formatted = (
                        cell.get("formattedValue")
                        or ((cell.get("effectiveValue") or {}).get("stringValue"))
                        or ""
                    )
                    row_values.append(str(formatted))
                if row_values:
                    values.append(row_values)
    if not values:
        return clip(flatten_doc_text(result), 8000)
    return clip("\n".join("\t".join(str(cell) for cell in row) for row in values), 8000)


def format_preview_result(source_app: str, result: dict[str, Any], fallback_title: str) -> str:
    if source_app == "google_docs":
        text = flatten_doc_text(result.get("body") or result)
        return clip(text or fallback_title, 8000)
    if source_app == "google_sheets":
        text = format_sheet_values(result)
        return clip(text or fallback_title, 8000)
    text = (
        result.get("content")
        or result.get("text")
        or result.get("body")
        or result.get("description")
        or result.get("webViewLink")
        or result.get("alternateLink")
        or fallback_title
    )
    return clip(text, 8000)


def parse_attendees(raw_attendees: str | list[str] | None) -> list[str]:
    if isinstance(raw_attendees, list):
        return [email.strip() for email in raw_attendees if str(email).strip()]
    if not raw_attendees:
        return []
    return [email.strip() for email in str(raw_attendees).split(",") if email.strip()]

