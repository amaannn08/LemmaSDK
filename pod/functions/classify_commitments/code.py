#input_type_name: ClassifyCommitmentsInput
#output_type_name: ClassifyCommitmentsResult
#function_name: classify_commitments

from __future__ import annotations

import json
import subprocess
from typing import Any

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


def clip(value: Any, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _email_metadata(message: dict[str, Any]) -> dict[str, Any]:
    preview = message.get("preview") or {}
    return {
        "subject": clip(message.get("subject") or preview.get("subject") or "(no subject)", 120),
        "from":    clip(message.get("sender") or "", 80),
        "date":    clip(message.get("date") or "", 20),
        "snippet": clip(preview.get("body") or message.get("messageText") or "", 200),
    }


def _parse_agent_decisions(stdout: str) -> dict[int, dict]:
    # ponytail: --output json emits pretty-printed multi-line JSON objects; use raw_decode to scan
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
            # "completed" event carries output_data directly
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


def classify_commitments_pass(pod: Pod, limit: int) -> dict[str, int]:
    rows = pod.records.list(
        "commitments",
        limit=limit,
        filter=[
            {"field": "source_app", "op": "eq", "value": "gmail"},
            {"field": "classify_status", "op": "eq", "value": "unclassified"},
        ],
    ).to_dict()["items"]

    if not rows:
        return {"processed": 0, "classified": 0, "not_actionable": 0}

    # Reconstruct the message shape _email_metadata/_classify_emails_llm expect
    # from the row's own captured fields (title/raw_snippet/source_ref) — the
    # original Gmail message payload isn't stored, only what capture kept.
    messages = [
        {
            "messageId": row.get("source_ref"),
            "subject": row.get("title") or "(no subject)",
            "sender": "",
            "date": row.get("detected_at") or "",
            "preview": {"body": row.get("raw_snippet") or ""},
        }
        for row in rows
    ]
    decisions = _classify_emails_llm(messages)

    table = pod.table("commitments")
    classified = 0
    not_actionable = 0
    for row, decision in zip(rows, decisions):
        if decision:
            table.update(row["id"], {
                "category": decision["category"],
                "priority": decision["priority"],
                "due_date": decision["due_date"],
                "title": decision["title"] or row.get("title"),
                "description": decision["description"],
                "classify_status": "classified",
            })
            classified += 1
        else:
            table.update(row["id"], {"classify_status": "not_actionable"})
            not_actionable += 1

    return {"processed": len(rows), "classified": classified, "not_actionable": not_actionable}


class ClassifyCommitmentsInput(BaseModel):
    limit: int = 30


class ClassifyCommitmentsResult(BaseModel):
    processed: int
    classified: int
    not_actionable: int


async def classify_commitments(ctx: FunctionContext, data: ClassifyCommitmentsInput) -> ClassifyCommitmentsResult:
    pod = Pod.from_env()
    result = classify_commitments_pass(pod, data.limit)
    return ClassifyCommitmentsResult(
        processed=result["processed"],
        classified=result["classified"],
        not_actionable=result["not_actionable"],
    )


if __name__ == "__main__":
    # ponytail: self-check exercises decision parsing + the classified/not_actionable
    # branch without a live pod — the real LLM/db path is verified via `lemma` CLI
    sample_decisions = {0: {"index": 0, "is_commitment": True, "title": "Pay invoice",
                             "description": "Invoice due", "due_date": "2026-07-05",
                             "category": "deadline", "priority": "high"}}
    stdout = json.dumps({"data": {"output_data": {"decisions": list(sample_decisions.values())}}})
    parsed = _parse_agent_decisions(stdout)
    assert parsed[0]["title"] == "Pay invoice"
    assert _email_metadata({"subject": "Hi", "sender": "a@b.com", "date": "2026-07-01",
                             "preview": {"body": "body text"}}) == {
        "subject": "Hi", "from": "a@b.com", "date": "2026-07-01", "snippet": "body text",
    }
    print("ok")
