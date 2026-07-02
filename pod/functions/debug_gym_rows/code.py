#function_name: debug_gym_rows
#input_type_name: DebugInput
#output_type_name: DebugOutput
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

class DebugInput(BaseModel):
    pass

class DebugOutput(BaseModel):
    rows: list[dict]
    total: int

async def debug_gym_rows(ctx: FunctionContext, data: DebugInput) -> DebugOutput:
    pod = Pod.from_env()
    rows = pod.records.list("commitments", limit=500).to_dict()["items"]
    gym = [{"id": r["id"][:8], "title": r.get("title","?")[:40], "due_date": r.get("due_date"), "source_ref": r.get("source_ref","")[:45], "status": r.get("status")} for r in rows if "gym" in (r.get("title") or "").lower() or "Gym" in (r.get("title") or "")]
    return DebugOutput(rows=gym, total=len(rows))
