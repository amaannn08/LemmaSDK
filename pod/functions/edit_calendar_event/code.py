#input_type_name: EditCalendarEventInput
#output_type_name: EditCalendarEventOutput
#function_name: edit_calendar_event

from __future__ import annotations

import json
import subprocess
from datetime import date, timedelta
from typing import Any

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

CONNECTOR_ALIASES = {
    "google_calendar": ["google_calendar", "my-calendar"],
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
        return payload.get("result") or {}
    return payload or {}


def cli_connector_result(connector: str, operation: str, payload: dict[str, Any]) -> dict[str, Any]:
    completed = subprocess.run(
        [
            "lemma",
            "--output",
            "json",
            "connectors",
            "operations",
            "execute",
            connector,
            operation,
            "--data",
            json.dumps({"payload": payload}),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return connector_result(json.loads(completed.stdout))


def try_connector_operations(
    pod: Pod, connector: str, candidates: list[tuple[str, list[dict[str, Any]]]]
) -> tuple[dict[str, Any], str]:
    last_error: Exception | None = None
    for connector_name in CONNECTOR_ALIASES.get(connector, [connector]):
        for operation_name, payloads in candidates:
            for payload in payloads:
                try:
                    return connector_result(pod.connectors.execute(connector_name, operation_name, payload)), operation_name
                except Exception as error:
                    try:
                        return cli_connector_result(connector_name, operation_name, payload), operation_name
                    except Exception:
                        last_error = error
    if last_error:
        raise last_error
    raise RuntimeError(f"No connector candidates configured for {connector}")


def calendar_get_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        ("GOOGLECALENDAR_GET_EVENT", [{"calendarId": "primary", "eventId": source_ref}, {"calendar_id": "primary", "event_id": source_ref}]),
        ("GOOGLECALENDAR_EVENTS_GET", [{"calendarId": "primary", "eventId": source_ref}, {"calendar_id": "primary", "event_id": source_ref}]),
        (
            "events_get",
            [
                {"calendarId": "primary", "eventId": source_ref},
                {"calendar_id": "primary", "event_id": source_ref},
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
    native_body: dict[str, Any] = {}
    for old_key, new_key in {
        "summary": "summary",
        "location": "location",
        "description": "description",
        "attendees": "attendees",
        "start": "start",
        "end": "end",
    }.items():
        if payload.get(old_key) is not None:
            native_body[new_key] = payload[old_key]
    return [
        (
            "events_patch",
            [
                {
                    "calendar_id": "primary",
                    "event_id": payload.get("eventId"),
                    "send_updates": "none",
                    "body": native_body,
                }
            ],
        ),
        ("GOOGLECALENDAR_UPDATE_EVENT", [payload]),
        ("GOOGLECALENDAR_EVENTS_PATCH", [payload]),
    ]


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
        "description": data.description,
        "location": data.location,
        "attendees": parse_attendees(data.attendees),
    }
    patch = calendar_patch_payload(current_event, updates)
    result, operation_name = try_connector_operations(
        pod, "google_calendar", calendar_patch_candidates(patch)
    )
    updated_fields = [field for field in ["title", "due_date", "description", "location", "attendees"] if updates.get(field)]
    event_id = str(result.get("id") or current_event.get("id") or commitment["source_ref"])
    return EditCalendarEventOutput(
        event_id=event_id,
        operation_name=operation_name,
        updated_fields=updated_fields,
        message="Calendar event updated.",
    )
