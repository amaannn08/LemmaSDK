#input_type_name: CreateCalendarEventInput
#output_type_name: CreateCalendarEventOutput
#function_name: create_calendar_event

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

CONNECTOR_ALIASES = {
    "google_calendar": ["google_calendar"],
}


def connector_result(response: Any) -> dict[str, Any]:
    payload = response.to_dict() if hasattr(response, "to_dict") else response
    if isinstance(payload, dict) and "result" in payload:
        result = payload.get("result") or {}
        # COMPOSIO wraps the real event under response_data on create/update.
        if isinstance(result.get("response_data"), dict):
            return result["response_data"]
        return result
    return payload or {}


def try_connector_operations(
    pod: Pod, connector: str, candidates: list[tuple[str, list[dict[str, Any]]]]
) -> tuple[dict[str, Any], str]:
    # One attempt per candidate — no CLI-subprocess fallback; that doubled
    # latency for no benefit and was pushing this API-type function past its
    # request timeout under load.
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


def caller_owns_account(pod: Pod, connector: str, user_id: str) -> bool:
    # Same guard as run_extraction: connector-account resolution in this runtime
    # can fall back to whichever account is connected pod-wide rather than
    # rejecting a caller with none of their own. Without this, anyone could
    # create a real Calendar event on someone else's connected account.
    if not user_id:
        return False
    for alias in CONNECTOR_ALIASES.get(connector, [connector]):
        try:
            accounts = pod.connectors.accounts.list(app=alias).to_dict().get("items", [])
        except Exception:
            continue
        if any(str(a.get("user_id")) == user_id and a.get("status") == "CONNECTED" for a in accounts):
            return True
    return False


def parse_attendees(raw_attendees: str | list[str] | None) -> list[str]:
    if isinstance(raw_attendees, list):
        return [email.strip() for email in raw_attendees if str(email).strip()]
    if not raw_attendees:
        return []
    return [email.strip() for email in str(raw_attendees).split(",") if email.strip()]


def create_event_candidates(
    title: str,
    start_iso: str,
    end_iso: str,
    tz: str,
    description: str | None,
    location: str | None,
    attendees: list[str],
) -> list[tuple[str, list[dict[str, Any]]]]:
    # start_iso/end_iso are naive local wall-clock times — without an explicit
    # timeZone, Google interprets them as UTC and the event lands 5-6 hours off
    # for anyone not in UTC (e.g. IST shows +5:30 later than what was typed).
    composio_payload: dict[str, Any] = {
        "calendar_id": "primary",
        "summary": title,
        "start_datetime": start_iso,
        "end_datetime": end_iso,
        "timezone": tz,
        "send_updates": "none",
    }
    if description:
        composio_payload["description"] = description
    if location:
        composio_payload["location"] = location
    if attendees:
        composio_payload["attendees"] = attendees

    return [("GOOGLECALENDAR_CREATE_EVENT", [composio_payload])]


class CreateCalendarEventInput(BaseModel):
    title: str
    due_date: str  # YYYY-MM-DD
    start_time: str | None = None  # HH:MM, defaults to 09:00
    end_time: str | None = None  # HH:MM, defaults to start_time + 1h
    timezone: str | None = None  # IANA name, e.g. "Asia/Kolkata" — defaults to UTC if omitted
    description: str | None = None
    location: str | None = None
    attendees: str | list[str] | None = None


class CreateCalendarEventOutput(BaseModel):
    commitment_id: str
    event_id: str
    message: str


async def create_calendar_event(
    ctx: FunctionContext, data: CreateCalendarEventInput
) -> CreateCalendarEventOutput:
    title = data.title.strip()
    if not title:
        raise ValueError("title is required")
    pod = Pod.from_env()
    if not caller_owns_account(pod, "google_calendar", str(ctx.user_id)):
        raise RuntimeError("not connected: no google_calendar account owned by this user")

    start_time = data.start_time or "09:00"
    start_hour, start_minute = (int(part) for part in start_time.split(":")[:2])
    if data.end_time:
        end_hour, end_minute = (int(part) for part in data.end_time.split(":")[:2])
    else:
        end_hour, end_minute = start_hour + 1, start_minute
    start_iso = f"{data.due_date}T{start_hour:02d}:{start_minute:02d}:00"
    end_iso = f"{data.due_date}T{min(end_hour, 23):02d}:{end_minute:02d}:00"

    attendees = parse_attendees(data.attendees)
    tz = data.timezone or "UTC"
    result, _ = try_connector_operations(
        pod,
        "google_calendar",
        create_event_candidates(title, start_iso, end_iso, tz, data.description, data.location, attendees),
    )
    event_id = str(result.get("id") or "")
    if not event_id:
        raise RuntimeError("Calendar did not return a new event id.")

    record = pod.table("commitments").create(
        {
            "title": title[:240],
            "description": (data.description or "").strip()[:2000] or None,
            "source_app": "google_calendar",
            "source_ref": event_id,
            "dedup_key": f"google_calendar:{event_id}",
            "due_date": data.due_date,
            "status": "open",
            "priority": "normal",
            "category": "deadline",
            "detected_at": datetime.now(timezone.utc).isoformat(),
            "classify_status": "classified",
        }
    )
    return CreateCalendarEventOutput(
        commitment_id=str(record["id"]), event_id=event_id, message="Calendar event created."
    )


if __name__ == "__main__":
    assert caller_owns_account(pod=None, connector="google_calendar", user_id="") is False
    print("ok")
