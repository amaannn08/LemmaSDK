#input_type_name: WriteBriefingInput
#output_type_name: WriteBriefingResult
#function_name: write_briefing

# Deterministic briefing persistence. briefing-agent returns {regenerate, content};
# this gates on regenerate and upserts today's row. Keeps the flaky LLM table-write
# off the data path (this runtime stringifies agent tool-call objects).

from datetime import datetime, timezone
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


class WriteBriefingInput(BaseModel):
    regenerate: bool = True
    content: str = ""
    briefing_date: str | None = None


class WriteBriefingResult(BaseModel):
    written: bool
    briefing_id: str | None = None


async def write_briefing(ctx: FunctionContext, data: WriteBriefingInput) -> WriteBriefingResult:
    if not data.regenerate or not (data.content or "").strip():
        return WriteBriefingResult(written=False)
    pod = Pod.from_env()
    today = data.briefing_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        rid = pod.table("briefing").create(
            {"briefing_date": today, "content": data.content, "generated_at": now_iso}
        )["id"]
    except Exception as error:
        if "unique" not in str(error).lower() and "duplicate" not in str(error).lower():
            raise
        existing = pod.records.list(
            "briefing",
            limit=1,
            filter=[{"field": "briefing_date", "op": "eq", "value": today}],
        ).to_dict()["items"]
        if not existing:
            raise
        rid = existing[0]["id"]
        pod.table("briefing").update(rid, {"content": data.content, "generated_at": now_iso})
    return WriteBriefingResult(written=True, briefing_id=str(rid))
