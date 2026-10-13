from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.extraction import ExtractedField, ExtractionResult, extract_bytes
from app.supabase_gateway import gateway

DISCLAIMER = "Arithmetic and extraction findings compare submitted evidence; they do not prove invoice genuineness, delivery, payment, fraud absence, or transaction truth."


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def field_json(field: ExtractedField) -> dict[str, Any]:
    return {"value": field.value, "normalized_value": field.normalized_value, "confidence": str(field.confidence), "provenance_type": field.provenance_type}


def field_value(result: ExtractionResult, key: str) -> Decimal | str | None:
    for item in result.fields:
        if item.key == key:
            if key in {"total_amount", "subtotal", "tax_amount", "delivered_amount", "quantity"}:
                try:
                    return Decimal(item.normalized_value)
                except Exception:
                    return None
            return item.normalized_value
    return None


async def extract_claim_documents(claim_id: UUID, documents: list[dict[str, Any]], actor_id: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for document in documents:
        content = await gateway.storage_download(document["storage_path"])
        result = extract_bytes(content, document["mime_type"])
        extraction_rows = await gateway.insert("document_extractions", {
            "claim_id": str(claim_id), "document_id": document["id"], "engine": result.engine,
            "engine_version": result.engine_version, "status": result.status, "error_code": result.error_code,
            "error_summary": result.error_summary, "started_at": now_iso(), "completed_at": now_iso(),
            "created_by": actor_id, "record_source": "system",
        }, service=True)
        extraction = extraction_rows[0]
        for field in result.fields:
            await gateway.insert("document_extracted_fields", {
                "extraction_id": extraction["id"], "claim_id": str(claim_id), "field_key": field.key,
                "raw_value": field_json(field), "normalized_value": field.normalized_value,
                "page_number": field.page_number, "confidence": str(field.confidence),
                "provenance_type": field.provenance_type, "record_source": "system",
            }, service=True)
        results.append({"document": document, "result": result, "extraction": extraction})
    return results


def finding(code: str, result: str, severity: str, summary: str, action: str, values: list[Any] | None = None, field_key: str | None = None) -> dict[str, Any]:
    return {"rule_code": code, "result": result, "severity": severity, "field_key": field_key, "evidence_summary": summary[:4000], "recommended_action": action[:1000], "source_values": values or []}


def _doc_result(extractions: list[dict[str, Any]], kind: str) -> ExtractionResult | None:
    for item in extractions:
        if item["document"]["document_type"] == kind:
            return item["result"]
    return None


def build_arithmetic_findings(claim: dict[str, Any], extractions: list[dict[str, Any]], line_items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    findings: list[dict[str, Any]] = []
    by_type = {kind: _doc_result(extractions, kind) for kind in ("invoice", "purchase_order", "delivery_receipt", "contract")}
    invoice = by_type["invoice"]
    if invoice is None or invoice.status != "completed":
        findings.append(finding("ARITHMETIC_INVOICE_TOTAL", "missing", "high", "Invoice total could not be extracted from the submitted invoice evidence.", "Provide a text-readable invoice or enable a working OCR runtime.", field_key="total_amount"))
    else:
        invoice_total = field_value(invoice, "total_amount")
        claim_amount = Decimal(str(claim["amount"]))
        if not isinstance(invoice_total, Decimal):
            findings.append(finding("ARITHMETIC_INVOICE_TOTAL", "uncertain", "medium", "Invoice evidence was extracted but no reliable total amount was found.", "Request a corrected invoice or human verification.", field_key="total_amount"))
        else:
            result = "pass" if invoice_total == claim_amount else "fail"
            findings.append(finding("ARITHMETIC_CLAIM_TOTAL", result, "none" if result == "pass" else "high", f"Extracted invoice total {invoice_total} compared with claim amount {claim_amount}.", "Continue review" if result == "pass" else "Correct the claim or reconcile the invoice amount.", [str(invoice_total), str(claim_amount)], "total_amount"))
    po_total = field_value(by_type["purchase_order"], "total_amount") if by_type["purchase_order"] else None
    invoice_total = field_value(invoice, "total_amount") if invoice else None
    if isinstance(invoice_total, Decimal) and isinstance(po_total, Decimal):
        result = "pass" if invoice_total <= po_total else "fail"
        findings.append(finding("ARITHMETIC_INVOICE_NOT_OVER_PO", result, "none" if result == "pass" else "high", f"Invoice total {invoice_total} compared with purchase-order total {po_total}.", "Continue review" if result == "pass" else "Resolve invoice versus purchase-order amount discrepancy.", [str(invoice_total), str(po_total)], "total_amount"))
    else:
        findings.append(finding("ARITHMETIC_INVOICE_NOT_OVER_PO", "missing", "medium", "Invoice or purchase-order total is unavailable for comparison.", "Provide both totals before relying on this comparison.", field_key="total_amount"))
    delivered = field_value(by_type["delivery_receipt"], "delivered_amount") if by_type["delivery_receipt"] else None
    if isinstance(invoice_total, Decimal) and isinstance(delivered, Decimal):
        result = "pass" if invoice_total <= delivered else "fail"
        findings.append(finding("ARITHMETIC_INVOICE_NOT_OVER_DELIVERY", result, "none" if result == "pass" else "high", f"Invoice total {invoice_total} compared with extracted delivered value {delivered}.", "Continue review" if result == "pass" else "Resolve invoice versus delivery-value discrepancy.", [str(invoice_total), str(delivered)], "delivered_amount"))
    else:
        findings.append(finding("ARITHMETIC_INVOICE_NOT_OVER_DELIVERY", "missing", "medium", "Invoice total or delivery value is unavailable for comparison.", "Request delivery evidence with a readable value.", field_key="delivered_amount"))
    if line_items:
        computed = sum((Decimal(str(item["quantity"])) * Decimal(str(item["unit_price"])) for item in line_items), Decimal("0"))
        declared = sum((Decimal(str(item["line_amount"])) for item in line_items), Decimal("0"))
        result = "pass" if computed == declared else "fail"
        findings.append(finding("ARITHMETIC_LINE_EXTENSION", result, "none" if result == "pass" else "high", f"Line extensions total {declared}; quantity multiplied by unit price totals {computed}.", "Continue review" if result == "pass" else "Correct inconsistent line-item arithmetic.", [str(declared), str(computed)], "line_amount"))
    else:
        findings.append(finding("ARITHMETIC_LINE_EXTENSION", "not_checked", "info", "No structured line items were supplied for arithmetic checking.", "Add structured line items for an additional arithmetic check.", field_key="line_amount"))
    levels = {item["severity"] for item in findings if item["result"] == "fail"}
    return findings, "high" if levels else ("moderate" if any(item["result"] in {"missing", "uncertain"} for item in findings) else "low")


async def persist_findings(run: dict[str, Any], claim_id: UUID, findings: list[dict[str, Any]]) -> None:
    for item in findings:
        item.update({"verification_run_id": run["id"], "claim_id": str(claim_id), "record_source": "system"})
        await gateway.insert("verification_findings", item, service=True)
