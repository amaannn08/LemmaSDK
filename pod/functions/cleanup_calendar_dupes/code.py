#function_name: cleanup_calendar_dupes
#input_type_name: CleanupInput
#output_type_name: CleanupOutput

import re
from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

INSTANCE_ID_RE = re.compile(r"_.+$")


class CleanupInput(BaseModel):
    pass


class CleanupOutput(BaseModel):
    deleted: int
    kept: int


async def cleanup_calendar_dupes(ctx: FunctionContext, data: CleanupInput) -> CleanupOutput:
    pod = Pod.from_env()
    rows = pod.records.list(
        "commitments",
        filter=[{"field": "source_app", "op": "eq", "value": "google_calendar"}],
        limit=500,
    ).to_dict()["items"]

    deleted = 0
    kept = 0
    for row in rows:
        source_ref = row.get("source_ref") or ""
        if INSTANCE_ID_RE.search(source_ref):
            pod.table("commitments").delete(row["id"])
            deleted += 1
        else:
            kept += 1

    return CleanupOutput(deleted=deleted, kept=kept)
