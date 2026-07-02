#input_type_name: CreateGmailDraftInput
#output_type_name: CreateGmailDraftOutput
#function_name: create_gmail_draft

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


def extract_gmail_message_id(source_ref: str) -> str:
    # commitments store source_ref as either a bare message id or a Gmail web
    # link like https://mail.google.com/mail/u/0/#inbox/<id> — the id is always
    # the last path segment.
    return source_ref.rsplit("/", 1)[-1]


def gmail_message_candidates(message_id: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [("GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID", [{"message_id": message_id}])]


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
    mime_lines = [
        f"To: {to}",
        f"Subject: {raw_payload['subject']}",
        "Content-Type: text/plain; charset=utf-8",
    ]
    if reply_to_message_id:
        mime_lines.append(f"In-Reply-To: {reply_to_message_id}")
        mime_lines.append(f"References: {reply_to_message_id}")
    mime_lines.extend(["", body])
    raw_mime = base64.urlsafe_b64encode("\r\n".join(mime_lines).encode("utf-8")).decode("ascii")
    # ponytail: LEMMA drafts_create rejects threadId inside message body; Gmail uses
    # In-Reply-To/References MIME headers for thread association instead.
    native_draft_body: dict[str, Any] = {"message": {"raw": raw_mime}}
    return [
        ("drafts_create", [{"user_id": "me", "body": native_draft_body}]),
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
    ]


class CreateGmailDraftInput(BaseModel):
    commitment_id: str
    body: str | None = None
    reply_text: str | None = None
    final_text: str | None = None


class CreateGmailDraftOutput(BaseModel):
    draft_id: str | None = None
    thread_id: str | None = None
    operation_name: str
    message: str


async def create_gmail_draft(
    ctx: FunctionContext, data: CreateGmailDraftInput
) -> CreateGmailDraftOutput:
    body = (data.body or data.reply_text or data.final_text or "").strip()
    if not body:
        raise ValueError("reply text is required")
    pod = Pod.from_env()
    commitment = get_commitment_record(pod, data.commitment_id)
    if commitment.get("source_app") != "gmail" or not commitment.get("source_ref"):
        raise ValueError("create_gmail_draft only supports Gmail commitments")
    message_id = extract_gmail_message_id(commitment["source_ref"])
    message, _ = try_connector_operations(pod, "gmail", gmail_message_candidates(message_id))
    thread_id = message_thread_id(message)
    result, operation_name = try_connector_operations(
        pod,
        "gmail",
        gmail_draft_candidates(
            thread_id=thread_id,
            subject=message_subject(message, commitment.get("title") or ""),
            body=body,
            reply_to_message_id=internet_message_id(message),
            to=message_sender(message),
        ),
    )
    draft_id = (
        result.get("id")
        or ((result.get("draft") or {}).get("id"))
        or result.get("draftId")
        or result.get("draft_id")
    )
    return CreateGmailDraftOutput(
        draft_id=str(draft_id) if draft_id else None,
        thread_id=thread_id,
        operation_name=operation_name,
        message="Draft created in Gmail.",
    )
