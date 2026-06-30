#input_type_name: GatherBriefingDataInput
#output_type_name: GatherBriefingDataOutput
#function_name: gather_briefing_data

import json
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

MAX_BRIEFING_ITEMS = 25
DONE_BUCKET_LIMIT = 5
OPEN_FETCH_LIMIT = 500
RECENT_DONE_LIMIT = 10
DESCRIPTION_CLIP = 220


class GatherBriefingDataInput(BaseModel):
    pass


class GatherBriefingDataOutput(BaseModel):
    should_regenerate: bool
    prompt: str
    watermark: str
    briefing_date: str
    item_count: int


def parse_dt(value: str | None) -> datetime:
    return datetime.fromisoformat((value or "2000-01-01T00:00:00+00:00").replace("Z", "+00:00"))


def clip(value: str | None, limit: int) -> str | None:
    text = (value or "").strip()
    return text[:limit] if text else None


def rank_priority(priority: str | None) -> int:
    return {"high": 0, "normal": 1, "low": 2}.get(priority or "normal", 1)


def compact_item(record: dict) -> dict:
    return {
        "id": record.get("id"),
        "title": record.get("title"),
        "due_date": record.get("due_date"),
        "category": record.get("category"),
        "priority": record.get("priority"),
        "detected_at": record.get("detected_at"),
        "updated_at": record.get("updated_at"),
        "description": clip(record.get("description"), DESCRIPTION_CLIP),
    }


def take_bucket(payload: dict, name: str, items: list[dict], remaining: int, max_items: int) -> int:
    picked = [compact_item(item) for item in items[: min(remaining, max_items)]]
    payload["buckets"][name] = picked
    return remaining - len(picked)


async def gather_briefing_data(ctx: FunctionContext, data: GatherBriefingDataInput) -> GatherBriefingDataOutput:
    pod = Pod.from_env()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    open_items = pod.records.list(
        "commitments",
        limit=OPEN_FETCH_LIMIT,
        filter=[{"field": "status", "op": "eq", "value": "open"}],
        sort=[{"field": "due_date", "direction": "asc"}],
    ).to_dict()["items"]
    recent_done = pod.records.list(
        "commitments",
        limit=RECENT_DONE_LIMIT,
        filter=[{"field": "status", "op": "eq", "value": "done"}],
        sort=[{"field": "updated_at", "direction": "desc"}],
    ).to_dict()["items"]
    latest_briefing = pod.records.list(
        "briefing",
        limit=1,
        sort=[{"field": "generated_at", "direction": "desc"}],
    ).to_dict()["items"]
    watermark = latest_briefing[0]["generated_at"] if latest_briefing else "never"
    watermark_dt = parse_dt(None if watermark == "never" else watermark)
    changed = watermark == "never" or any(
        parse_dt(record.get("updated_at") or record.get("detected_at")) > watermark_dt
        for record in [*open_items, *recent_done]
    )
    if not changed:
        return GatherBriefingDataOutput(
            should_regenerate=False,
            prompt="should_regenerate=False",
            watermark=watermark,
            briefing_date=today,
            item_count=0,
        )

    now = datetime.now(timezone.utc)
    today_iso = now.strftime("%Y-%m-%d")
    week_end = (now + timedelta(days=7)).strftime("%Y-%m-%d")
    stale_before = now - timedelta(days=5)
    summary = {
        "open_total": len(open_items),
        "done_total": len(recent_done),
        "by_category": {},
        "due_today_count": 0,
        "due_this_week_count": 0,
        "overdue_count": 0,
    }
    for item in open_items:
        category = item.get("category") or "uncategorized"
        summary["by_category"][category] = summary["by_category"].get(category, 0) + 1
        due_date = item.get("due_date")
        if due_date and due_date < today_iso:
            summary["overdue_count"] += 1
        elif due_date == today_iso:
            summary["due_today_count"] += 1
        elif due_date and due_date <= week_end:
            summary["due_this_week_count"] += 1

    overdue_items = sorted(
        [item for item in open_items if item.get("due_date") and item["due_date"] < today_iso],
        key=lambda item: (rank_priority(item.get("priority")), item.get("due_date") or "9999-12-31"),
    )
    due_today_items = sorted(
        [item for item in open_items if item.get("due_date") == today_iso],
        key=lambda item: rank_priority(item.get("priority")),
    )
    due_this_week_items = sorted(
        [item for item in open_items if item.get("due_date") and today_iso < item["due_date"] <= week_end],
        key=lambda item: (rank_priority(item.get("priority")), item.get("due_date") or "9999-12-31"),
    )
    stale_followups = sorted(
        [
            item
            for item in open_items
            if item.get("category") == "followup"
            and parse_dt(item.get("updated_at") or item.get("detected_at")) < stale_before
        ],
        key=lambda item: parse_dt(item.get("updated_at") or item.get("detected_at")),
    )
    recent_done_items = sorted(
        recent_done,
        key=lambda item: parse_dt(item.get("updated_at") or item.get("detected_at")),
        reverse=True,
    )

    payload = {
        "briefing_date": today,
        "summary": summary,
        "buckets": {},
    }
    remaining = MAX_BRIEFING_ITEMS
    remaining = take_bucket(payload, "overdue", overdue_items, remaining, 8)
    remaining = take_bucket(payload, "due_today", due_today_items, remaining, 7)
    remaining = take_bucket(payload, "due_this_week", due_this_week_items, remaining, 5)
    remaining = take_bucket(payload, "stale_followups", stale_followups, remaining, 5)
    remaining = take_bucket(payload, "recent_done", recent_done_items, remaining, DONE_BUCKET_LIMIT)
    item_count = MAX_BRIEFING_ITEMS - remaining
    prompt = "should_regenerate=True\n\nprepared_briefing_payload:\n" + json.dumps(payload, indent=2)
    return GatherBriefingDataOutput(
        should_regenerate=True,
        prompt=prompt,
        watermark=watermark,
        briefing_date=today,
        item_count=item_count,
    )
