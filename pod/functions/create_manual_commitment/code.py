#input_type_name: CreateManualCommitmentInput
#output_type_name: CreateManualCommitmentOutput
#function_name: create_manual_commitment

from datetime import datetime, timezone

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


class CreateManualCommitmentInput(BaseModel):
    title: str
    description: str | None = None
    category: str | None = "loop"
    priority: str | None = "normal"
    due_date: str | None = None


class CreateManualCommitmentOutput(BaseModel):
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


async def create_manual_commitment(
    ctx: FunctionContext, data: CreateManualCommitmentInput
) -> CreateManualCommitmentOutput:
    title = data.title.strip()
    if not title:
        raise ValueError("title is required")
    pod = Pod.from_env()
    record = pod.table("commitments").create(
        {
            "title": title[:240],
            "description": (data.description or "").strip()[:2000] or None,
            "source_app": "manual",
            "due_date": data.due_date,
            "status": "open",
            "priority": (data.priority or "normal"),
            "category": data.category,
            "detected_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return CreateManualCommitmentOutput(**record)

