from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

import fitz
from PIL import Image

from app.config import settings

try:
    import pytesseract
except ImportError:  # pragma: no cover - dependency is optional at runtime
    pytesseract = None


def _ocr_version() -> str:
    if pytesseract is None:
        return ""
    try:
        return str(pytesseract.get_tesseract_version())
    except Exception:
        return "unavailable"


@dataclass(frozen=True)
class ExtractedField:
    key: str
    value: str
    normalized_value: str
    confidence: Decimal
    page_number: int | None
    provenance_type: str = "extracted"


@dataclass
class ExtractionResult:
    status: str
    engine: str
    engine_version: str
    text: str
    fields: list[ExtractedField] = field(default_factory=list)
    page_count: int = 0
    error_code: str = ""
    error_summary: str = ""


def parse_decimal(value: str) -> Decimal | None:
    cleaned = value.strip().replace("₹", "").replace("$", "").replace("€", "").replace("£", "")
    cleaned = re.sub(r"[^0-9.,()-]", "", cleaned)
    if not cleaned:
        return None
    negative = cleaned.startswith("(") and cleaned.endswith(")")
    cleaned = cleaned.strip("()")
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(",", "") if cleaned.rfind(".") > cleaned.rfind(",") else cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        parts = cleaned.split(",")
        cleaned = "".join(parts) if len(parts[-1]) == 3 else ".".join(parts)
    try:
        number = Decimal(cleaned)
        return -number if negative else number
    except InvalidOperation:
        return None


def _field(key: str, value: str, confidence: Decimal, page: int | None = None) -> ExtractedField:
    normalized = value.strip()
    if key in {"amount", "subtotal", "tax_amount", "total_amount", "quantity"}:
        parsed = parse_decimal(value)
        normalized = str(parsed) if parsed is not None else ""
    elif key.endswith("_date"):
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
            try:
                normalized = datetime.strptime(value.strip(), fmt).date().isoformat()
                break
            except (ValueError, AttributeError):
                continue
    return ExtractedField(key, value.strip(), normalized, confidence, page)


def parse_fields(text: str, confidence: Decimal = Decimal("0.72")) -> list[ExtractedField]:
    patterns: list[tuple[str, str]] = [
        ("invoice_number", r"(?:invoice\s*(?:no|number|#)|inv\s*#)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9/_-]{1,80})"),
        ("purchase_order_reference", r"(?:purchase\s*order|p\.?o\.?|po\s*number)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9/_-]{1,80})"),
        ("invoice_date", r"(?:invoice\s*date|date\s*of\s*invoice|dated)\s*[:#-]?\s*(\d{1,4}[/-]\d{1,2}[/-]\d{2,4})"),
        ("due_date", r"(?:due\s*date|payment\s*due)\s*[:#-]?\s*(\d{1,4}[/-]\d{1,2}[/-]\d{2,4})"),
        ("currency", r"(?:currency)\s*[:#-]?\s*(INR|USD|EUR|GBP|AUD|CAD|AED|₹|\$|€|£)"),
        ("subtotal", r"(?:subtotal|sub-total)\s*[:=]?\s*([₹$€£]?\s*[\d,]+(?:\.\d{1,2})?)"),
        ("tax_amount", r"(?:tax|gst|vat)\s*(?:amount)?\s*[:=]?\s*([₹$€£]?\s*[\d,]+(?:\.\d{1,2})?)"),
        ("total_amount", r"(?:grand\s*total|invoice\s*total|total\s*amount|total)\s*[:=]?\s*([₹$€£]?\s*[\d,]+(?:\.\d{1,2})?)"),
        ("delivered_amount", r"(?:delivered\s*amount|delivery\s*value|received\s*value)\s*[:=]?\s*([₹$€£]?\s*[\d,]+(?:\.\d{1,2})?)"),
    ]
    fields: list[ExtractedField] = []
    for key, pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = match.group(1)
            if key == "currency":
                value = {"₹": "INR", "$": "USD", "€": "EUR", "£": "GBP"}.get(value, value).upper()
            fields.append(_field(key, value, confidence))
    return fields


def extract_bytes(content: bytes, mime_type: str) -> ExtractionResult:
    if mime_type == "application/pdf":
        return _extract_pdf(content)
    if mime_type in {"image/jpeg", "image/png", "image/webp"}:
        return _extract_image(content)
    return ExtractionResult("failed", "none", "", "", error_code="UNSUPPORTED_MIME", error_summary="Evidence type is not supported")


def _extract_pdf(content: bytes) -> ExtractionResult:
    if not content.startswith(b"%PDF-"):
        return ExtractionResult("failed", "pymupdf", "1", "", error_code="NOT_A_PDF", error_summary="File bytes do not have a PDF signature")
    try:
        pdf = fitz.open(stream=content, filetype="pdf")
    except Exception:
        return ExtractionResult("failed", "pymupdf", "1", "", error_code="PDF_PARSE_FAILED", error_summary="PDF could not be parsed")
    if pdf.is_encrypted:
        return ExtractionResult("failed", "pymupdf", "1", "", error_code="PDF_ENCRYPTED", error_summary="Encrypted PDFs are not processed")
    if len(pdf) > settings.max_pdf_pages:
        return ExtractionResult("failed", "pymupdf", "1", "", page_count=len(pdf), error_code="PDF_PAGE_LIMIT", error_summary="PDF page limit exceeded")
    page_text = [page.get_text("text") for page in pdf]
    text = "\n".join(page_text)
    if text.strip():
        return ExtractionResult("completed", "pymupdf", fitz.VersionBind, text, parse_fields(text, Decimal("0.90")), len(pdf))
    if not settings.ocr_enabled or pytesseract is None:
        return ExtractionResult("failed", "pymupdf", fitz.VersionBind, "", page_count=len(pdf), error_code="OCR_UNAVAILABLE", error_summary="PDF has no extractable text and OCR is not enabled or installed")
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
    ocr_pages: list[str] = []
    for page in pdf:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
        ocr_pages.append(pytesseract.image_to_string(image))
    ocr_text = "\n".join(ocr_pages)
    if not ocr_text.strip():
        return ExtractionResult("failed", "pytesseract", _ocr_version(), "", page_count=len(pdf), error_code="OCR_EMPTY", error_summary="OCR returned no text")
    return ExtractionResult("completed", "pytesseract", _ocr_version(), ocr_text, parse_fields(ocr_text, Decimal("0.65")), len(pdf))


def _extract_image(content: bytes) -> ExtractionResult:
    if not settings.ocr_enabled or pytesseract is None:
        return ExtractionResult("failed", "pytesseract", "", "", error_code="OCR_UNAVAILABLE", error_summary="OCR is not enabled or installed")
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
    try:
        image = Image.open(BytesIO(content))
        text = pytesseract.image_to_string(image)
    except Exception:
        return ExtractionResult("failed", "pytesseract", "", "", error_code="OCR_FAILED", error_summary="Image OCR failed")
    return ExtractionResult("completed" if text.strip() else "failed", "pytesseract", _ocr_version(), text, parse_fields(text, Decimal("0.65")), 1, "" if text.strip() else "OCR_EMPTY", "" if text.strip() else "OCR returned no text")
