from decimal import Decimal

from app.extraction import ExtractionResult, ExtractedField, parse_decimal
from app.verification import build_arithmetic_findings


def result(kind: str, total: str | None = None, delivered: str | None = None) -> dict:
    fields = []
    if total is not None:
        fields.append(ExtractedField("total_amount", total, total, Decimal("0.90"), 1))
    if delivered is not None:
        fields.append(ExtractedField("delivered_amount", delivered, delivered, Decimal("0.90"), 1))
    return {"document": {"document_type": kind}, "result": ExtractionResult("completed", "test", "1", "", fields, 1)}


def test_parse_decimal_handles_indian_grouping():
    assert parse_decimal("₹ 8,45,000.00") == Decimal("845000.00")


def test_arithmetic_flags_invoice_over_purchase_order():
    findings, level = build_arithmetic_findings(
        {"amount": "100.00"},
        [result("invoice", "100.00"), result("purchase_order", "90.00"), result("delivery_receipt", delivered="100.00")],
        [],
    )
    assert level == "high"
    assert next(item for item in findings if item["rule_code"] == "ARITHMETIC_INVOICE_NOT_OVER_PO")["result"] == "fail"


def test_line_extension_uses_decimal_arithmetic():
    findings, _ = build_arithmetic_findings(
        {"amount": "10.00"},
        [result("invoice", "10.00")],
        [{"quantity": "2.000", "unit_price": "5.00", "line_amount": "10.00"}],
    )
    assert next(item for item in findings if item["rule_code"] == "ARITHMETIC_LINE_EXTENSION")["result"] == "pass"
