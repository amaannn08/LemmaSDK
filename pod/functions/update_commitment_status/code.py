#input_type_name: UpdateCommitmentStatusInput
#output_type_name: UpdateCommitmentStatusOutput
#function_name: update_commitment_status

from __future__ import annotations

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


class UpdateCommitmentStatusInput(BaseModel):
    id: str | None = None
    record_id: str | None = None
    commitment_id: str | None = None
    status: str
    snooze_until: str | None = None
    due_date: str | None = None


class UpdateCommitmentStatusOutput(BaseModel):
    id: str
    title: str
    description: str | None = None
    source_app: str
    source_ref: str | None = None
    due_date: str | None = None
    status: str
    priority: str
    category: str | None = None
    detected_at: str


async def update_commitment_status(
    ctx: FunctionContext, data: UpdateCommitmentStatusInput
) -> UpdateCommitmentStatusOutput:
    record_id = (data.id or data.record_id or data.commitment_id or "").strip()
    if not record_id:
        raise ValueError("id is required")
    next_status = data.status.strip().lower()
    if next_status not in {"open", "done", "snoozed"}:
        raise ValueError("status must be one of open, done, snoozed")
    pod = Pod.from_env()
    items = pod.records.list(
        "commitments",
        limit=1,
        filter=[{"field": "id", "op": "eq", "value": record_id}],
    ).to_dict()["items"]
    if not items:
        raise ValueError("commitment not found")
    record = items[0]
    payload = {"status": next_status}
    if next_status == "snoozed" and (data.snooze_until or data.due_date):
        payload["due_date"] = data.snooze_until or data.due_date
    updated = pod.table("commitments").update(record_id, payload)
    merged = {**record, **updated}
    return UpdateCommitmentStatusOutput(**merged)
