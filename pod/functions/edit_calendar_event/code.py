#input_type_name: EditCalendarEventInput
#output_type_name: EditCalendarEventOutput
#function_name: edit_calendar_event

from __future__ import annotations

from typing import Any

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

CONNECTOR_ALIASES = {
    "google_calendar": ["google_calendar"],
}


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
        result = payload.get("result") or {}
        # COMPOSIO wraps the real event under response_data on some operations
        # (create/update); GET operations return it flat. Prefer the nested
        # shape when present so id/start/end resolve either way.
        if isinstance(result.get("response_data"), dict):
            return result["response_data"]
        return result
    return payload or {}


def try_connector_operations(
    pod: Pod, connector: str, candidates: list[tuple[str, list[dict[str, Any]]]]
) -> tuple[dict[str, Any], str]:
    # One attempt per candidate — no CLI-subprocess fallback. Retrying a failed
    # call by re-spawning the CLI just doubles latency for the same result and
    # was pushing this API-type function past its request timeout under load.
    last_error: Exception | None = None
    for connector_name in CONNECTOR_ALIASES.get(connector, [connector]):
        for operation_name, payloads in candidates:
            for payload in payloads:
                try:
                    return connector_result(pod.connectors.execute(connector_name, operation_name, payload)), operation_name
                except Exception as error:
                    last_error = error
    if last_error:
        raise last_error
    raise RuntimeError(f"No connector candidates configured for {connector}")


def calendar_get_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        ("GOOGLECALENDAR_EVENTS_GET", [{"calendar_id": "primary", "event_id": source_ref}]),
    ]


def current_date_and_times(current_event: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    # Returns (date, start_time HH:MM, end_time HH:MM) from whichever shape the
    # existing event has — all-day {"date": ...} or timed {"dateTime": ...}.
    start = current_event.get("start") or {}
    end = current_event.get("end") or {}
    if start.get("dateTime"):
        start_dt, end_dt = start["dateTime"], end.get("dateTime") or start["dateTime"]
        return start_dt[:10], start_dt[11:16], end_dt[11:16]
    return start.get("date"), None, None


def calendar_patch_payload(current_event: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    # GOOGLECALENDAR_UPDATE_EVENT requires event_id, start_datetime, and
    # end_datetime on every call (there's no partial-patch shape) — so an edit
    # that only changes the title still has to resend the effective start/end,
    # falling back to whatever the event already has.
    current_date, current_start, current_end = current_date_and_times(current_event)
    effective_date = updates.get("due_date") or current_date
    effective_start = updates.get("start_time") or current_start or "09:00"
    effective_end = updates.get("end_time") or current_end or effective_start
    payload: dict[str, Any] = {
        "calendar_id": "primary",
        "event_id": current_event.get("id"),
        "start_datetime": f"{effective_date}T{effective_start}:00",
        "end_datetime": f"{effective_date}T{effective_end}:00",
        # Naive local wall-clock times default to UTC on Google's side without
        # this — see create_calendar_event for the same fix.
        "timezone": updates.get("timezone") or "UTC",
        "send_updates": "none",
    }
    if updates.get("title"):
        payload["summary"] = updates["title"]
    if updates.get("location") is not None:
        payload["location"] = updates["location"]
    if updates.get("description") is not None:
        payload["description"] = updates["description"]
    attendees = updates.get("attendees") or []
    if attendees:
        payload["attendees"] = attendees
    return payload


def calendar_patch_candidates(payload: dict[str, Any]) -> list[tuple[str, list[dict[str, Any]]]]:
    return [("GOOGLECALENDAR_UPDATE_EVENT", [payload])]


def parse_attendees(raw_attendees: str | list[str] | None) -> list[str]:
    if isinstance(raw_attendees, list):
        return [email.strip() for email in raw_attendees if str(email).strip()]
    if not raw_attendees:
        return []
    return [email.strip() for email in str(raw_attendees).split(",") if email.strip()]


class EditCalendarEventInput(BaseModel):
    commitment_id: str
    title: str | None = None
    due_date: str | None = None
    start_time: str | None = None  # HH:MM
    end_time: str | None = None  # HH:MM
    timezone: str | None = None  # IANA name, e.g. "Asia/Kolkata"
    description: str | None = None
    location: str | None = None
    attendees: str | list[str] | None = None


class EditCalendarEventOutput(BaseModel):
    event_id: str
    operation_name: str
    updated_fields: list[str]
    message: str


async def edit_calendar_event(
    ctx: FunctionContext, data: EditCalendarEventInput
) -> EditCalendarEventOutput:
    pod = Pod.from_env()
    commitment = get_commitment_record(pod, data.commitment_id)
    if commitment.get("source_app") != "google_calendar" or not commitment.get("source_ref"):
        raise ValueError("edit_calendar_event only supports Calendar commitments")
    current_event, _ = try_connector_operations(
        pod, "google_calendar", calendar_get_candidates(commitment["source_ref"])
    )
    updates = {
        "title": data.title,
        "due_date": data.due_date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "timezone": data.timezone,
        "description": data.description,
        "location": data.location,
        "attendees": parse_attendees(data.attendees),
    }
    patch = calendar_patch_payload(current_event, updates)
    result, operation_name = try_connector_operations(
        pod, "google_calendar", calendar_patch_candidates(patch)
    )
    updated_fields = [
        field
        for field in ["title", "due_date", "start_time", "end_time", "description", "location", "attendees"]
        if updates.get(field)
    ]
    event_id = str(result.get("id") or current_event.get("id") or commitment["source_ref"])
    return EditCalendarEventOutput(
        event_id=event_id,
        operation_name=operation_name,
        updated_fields=updated_fields,
        message="Calendar event updated.",
    )
