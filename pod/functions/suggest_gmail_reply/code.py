#input_type_name: SuggestGmailReplyInput
#output_type_name: SuggestGmailReplyOutput
#function_name: suggest_gmail_reply

from __future__ import annotations

import json
import subprocess
from typing import Any

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

CONNECTOR_ALIASES = {
    "gmail": ["gmail", "my-gmail"],
}


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


def message_excerpt(message: dict[str, Any], limit: int = 1200) -> str:
    preview = message.get("preview") or {}
    text = preview.get("body") or message.get("messageText") or message.get("snippet") or message.get("text") or ""
    return clip(text, limit)


def gmail_message_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        (
            "messages_get",
            [
                {"user_id": "me", "id": source_ref, "format": "full"},
                {"user_id": "me", "message_id": source_ref, "format": "full"},
            ],
        ),
        ("GMAIL_GET_MESSAGE", [{"message_id": source_ref}, {"messageId": source_ref}, {"id": source_ref}]),
        ("GMAIL_FETCH_MESSAGE", [{"message_id": source_ref}, {"messageId": source_ref}, {"id": source_ref}]),
    ]


class SuggestGmailReplyInput(BaseModel):
    commitment_id: str


class SuggestGmailReplyOutput(BaseModel):
    prompt: str
    sender: str
    subject: str
    excerpt: str


async def suggest_gmail_reply(
    ctx: FunctionContext, data: SuggestGmailReplyInput
) -> SuggestGmailReplyOutput:
    pod = Pod.from_env()
    commitment = get_commitment_record(pod, data.commitment_id)
    if commitment.get("source_app") != "gmail" or not commitment.get("source_ref"):
        raise ValueError("suggest_gmail_reply only supports Gmail commitments")
    message, _ = try_connector_operations(pod, "gmail", gmail_message_candidates(commitment["source_ref"]))
    sender = clip(message_sender(message), 160)
    subject = clip(message_subject(message, commitment.get("title") or ""), 240)
    excerpt = clip(message_excerpt(message), 1200)
    prompt = "\n".join(
        [
            "You draft a short Gmail reply suggestion for a personal productivity app.",
            "Return only the reply body text, with no preamble, labels, or markdown fences.",
            "Stay concise, helpful, and natural. Do not invent facts or promises not implied by the message.",
            "",
            f"Commitment title: {clip(commitment.get('title') or '', 240)}",
            f"Commitment metadata: source_app=gmail; category={commitment.get('category') or 'unknown'}; priority={commitment.get('priority') or 'normal'}",
            f"Sender: {sender or 'Unknown sender'}",
            f"Subject: {subject}",
            f"Excerpt: {excerpt or '(no plain-text excerpt available)'}",
        ]
    )
    return SuggestGmailReplyOutput(prompt=prompt, sender=sender, subject=subject, excerpt=excerpt)
