#input_type_name: PreviewDocumentInput
#output_type_name: PreviewDocumentOutput
#function_name: preview_document

from __future__ import annotations

import json
import subprocess
from typing import Any

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

CONNECTOR_ALIASES = {
    "google_drive": ["google_drive", "my-drive"],
    "google_docs": ["google_docs", "my-docs"],
    "google_sheets": ["google_sheets", "my-sheets"],
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


def drive_preview_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        ("GOOGLEDRIVE_GET_FILE_CONTENT", [{"fileId": source_ref}, {"file_id": source_ref}, {"id": source_ref}]),
        ("GOOGLEDRIVE_GET_FILE", [{"fileId": source_ref}, {"file_id": source_ref}, {"id": source_ref}]),
        ("files_get", [{"fileId": source_ref}, {"file_id": source_ref}, {"id": source_ref}]),
    ]


def docs_preview_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        ("GOOGLEDOCS_GET_DOCUMENT_BY_ID", [{"documentId": source_ref}, {"id": source_ref}]),
        ("GOOGLEDOCS_GET_DOCUMENT", [{"documentId": source_ref}, {"id": source_ref}]),
        ("documents_get", [{"documentId": source_ref}, {"document_id": source_ref}, {"id": source_ref}]),
    ]


def sheets_preview_candidates(source_ref: str) -> list[tuple[str, list[dict[str, Any]]]]:
    return [
        (
            "spreadsheets_values_get",
            [
                {"spreadsheet_id": source_ref, "range": "A1:Z200"},
                {"spreadsheetId": source_ref, "range": "A1:Z200"},
            ],
        ),
        (
            "spreadsheets_get",
            [
                {"spreadsheet_id": source_ref, "ranges": ["A1:Z200"], "include_grid_data": True},
                {"spreadsheetId": source_ref, "ranges": ["A1:Z200"], "includeGridData": True},
            ],
        ),
        (
            "GOOGLESHEETS_GET_VALUES",
            [
                {"spreadsheetId": source_ref, "range": "A1:Z200"},
                {"spreadsheet_id": source_ref, "range": "A1:Z200"},
            ],
        ),
        ("GOOGLESHEETS_GET_SPREADSHEET", [{"spreadsheetId": source_ref}, {"spreadsheet_id": source_ref}, {"id": source_ref}]),
    ]


def flatten_doc_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(part for part in (flatten_doc_text(item) for item in value) if part)
    if isinstance(value, dict):
        text_run = value.get("textRun") or value.get("text_run")
        if isinstance(text_run, dict):
            content = text_run.get("content")
            if isinstance(content, str):
                return content
        paragraph = value.get("paragraph")
        if isinstance(paragraph, dict):
            return flatten_doc_text(paragraph.get("elements") or [])
        table = value.get("table")
        if isinstance(table, dict):
            return flatten_doc_text(table.get("tableRows") or [])
        cells = value.get("tableCells") or value.get("cells")
        if cells:
            return flatten_doc_text(cells)
        values = [flatten_doc_text(item) for item in value.values()]
        return "\n".join(part for part in values if part)
    return ""


def format_sheet_values(result: dict[str, Any]) -> str:
    values = result.get("values")
    if not values and result.get("sheets"):
        values = []
        for sheet in result.get("sheets") or []:
            data = (((sheet.get("data") or [{}])[0]).get("rowData") or [])
            for row in data:
                row_values = []
                for cell in row.get("values") or []:
                    formatted = cell.get("formattedValue") or ((cell.get("effectiveValue") or {}).get("stringValue")) or ""
                    row_values.append(str(formatted))
                if row_values:
                    values.append(row_values)
    if not values:
        return clip(flatten_doc_text(result), 8000)
    return clip("\n".join("\t".join(str(cell) for cell in row) for row in values), 8000)


def format_preview_result(source_app: str, result: dict[str, Any], fallback_title: str) -> str:
    if source_app == "google_docs":
        text = flatten_doc_text(result.get("body") or result)
        return clip(text or fallback_title, 8000)
    if source_app == "google_sheets":
        text = format_sheet_values(result)
        return clip(text or fallback_title, 8000)
    text = (
        result.get("content")
        or result.get("text")
        or result.get("body")
        or result.get("description")
        or result.get("webViewLink")
        or result.get("alternateLink")
        or fallback_title
    )
    return clip(text, 8000)


class PreviewDocumentInput(BaseModel):
    commitment_id: str


class PreviewDocumentOutput(BaseModel):
    content: str
    source_app: str
    operation_name: str


async def preview_document(
    ctx: FunctionContext, data: PreviewDocumentInput
) -> PreviewDocumentOutput:
    pod = Pod.from_env()
    commitment = get_commitment_record(pod, data.commitment_id)
    source_app = commitment.get("source_app")
    source_ref = commitment.get("source_ref")
    if not source_ref or source_app not in {"google_drive", "google_docs", "google_sheets"}:
        raise ValueError("preview_document only supports Drive, Docs, and Sheets commitments")
    if source_app == "google_docs":
        result, operation_name = try_connector_operations(pod, "google_docs", docs_preview_candidates(source_ref))
    elif source_app == "google_sheets":
        result, operation_name = try_connector_operations(pod, "google_sheets", sheets_preview_candidates(source_ref))
    else:
        result, operation_name = try_connector_operations(pod, "google_drive", drive_preview_candidates(source_ref))
    return PreviewDocumentOutput(
        content=format_preview_result(source_app, result, commitment.get("title") or "Document preview"),
        source_app=source_app,
        operation_name=operation_name,
    )
