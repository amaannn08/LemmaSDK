#input_type_name: CreateNewGmailDraftInput
#output_type_name: CreateNewGmailDraftOutput
#function_name: create_new_gmail_draft

from __future__ import annotations

import base64
import json
import subprocess
from typing import Any

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

CONNECTOR_ALIASES = {
    "gmail": ["gmail", "my-gmail"],
}


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


def new_draft_candidates(*, to: str, subject: str, body: str) -> list[tuple[str, list[dict[str, Any]]]]:
    raw_payload = {"to": to, "subject": subject, "body": body}
    mime_lines = [
        f"To: {to}",
        f"Subject: {subject}",
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
    ]
    raw_mime = base64.urlsafe_b64encode("\r\n".join(mime_lines).encode("utf-8")).decode("ascii")
    native_draft_body: dict[str, Any] = {"message": {"raw": raw_mime}}
    return [
        ("drafts_create", [{"user_id": "me", "body": native_draft_body}]),
        ("GMAIL_CREATE_EMAIL_DRAFT", [raw_payload, {"message": raw_payload}]),
        ("GMAIL_CREATE_DRAFT", [raw_payload]),
    ]


class CreateNewGmailDraftInput(BaseModel):
    to: str
    subject: str
    body: str


class CreateNewGmailDraftOutput(BaseModel):
    draft_id: str | None = None
    operation_name: str
    message: str


async def create_new_gmail_draft(
    ctx: FunctionContext, data: CreateNewGmailDraftInput
) -> CreateNewGmailDraftOutput:
    to = data.to.strip()
    subject = data.subject.strip() or "(no subject)"
    body = data.body.strip()
    if not to:
        raise ValueError("recipient (to) is required")
    if not body:
        raise ValueError("body is required")
    pod = Pod.from_env()
    result, operation_name = try_connector_operations(pod, "gmail", new_draft_candidates(to=to, subject=subject, body=body))
    draft_id = (
        result.get("id")
        or ((result.get("draft") or {}).get("id"))
        or result.get("draftId")
        or result.get("draft_id")
    )
    return CreateNewGmailDraftOutput(
        draft_id=str(draft_id) if draft_id else None,
        operation_name=operation_name,
        message=f"Draft created in Gmail to {to}. This only creates a draft — it does not send anything.",
    )
