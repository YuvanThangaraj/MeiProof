from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Role = Literal["seller", "buyer", "lender"]

class ClaimCreate(BaseModel):
    buyer_organization_id: UUID
    invoice_number: str = Field(min_length=1, max_length=120)
    invoice_date: date | None = None
    due_date: date | None = None
    currency: str = Field(min_length=3, max_length=3)
    amount: Decimal = Field(gt=0)
    purchase_order_reference: str = Field(default="", max_length=200)
    payment_terms_days: int | None = Field(default=None, ge=0, le=3650)

class BuyerResponseCreate(BaseModel):
    response: Literal["confirmed", "disputed", "correction_requested"]
    reason_code: str = Field(default="", max_length=120)
    comment: str = Field(default="", max_length=4000)

class LenderReviewCreate(BaseModel):
    decision: Literal["pending", "request_information", "declined", "approved_for_financing"]
    note: str = Field(default="", max_length=4000)

class VerifyRequest(BaseModel):
    ruleset: str = Field(default="meiproof-mvp", max_length=120)

class RegistryReserveRequest(BaseModel):
    lender_organization_id: UUID
    reservation_hours: int = Field(default=24, ge=1, le=720)

class RegistryTransitionRequest(BaseModel):
    next_status: Literal["partially_financed", "financed", "repaid", "released", "expired"]
    financed_amount: Decimal | None = Field(default=None, ge=0)
    note: str = Field(default="", max_length=2000)

class EvidenceResponse(BaseModel):
    id: UUID
    document_type: str
    sha256_hash: str
    extraction_status: str
    signed_url: str | None = None
    simulated: bool = False

class VerificationResponse(BaseModel):
    verification_run: dict
    findings: list[dict]
    transaction_integrity: dict
    payment_risk: dict
    disclaimer: str = "Evidence matching and risk indicators are not proof of transaction truth, invoice genuineness, fraud absence, or creditworthiness."

class RegistryResponse(BaseModel):
    outcome: str
    reservation_id: UUID | None = None
    scope: str = "participating MeiProof registry only"
    message: str
    simulated: bool = False
