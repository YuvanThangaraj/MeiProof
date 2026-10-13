from __future__ import annotations

import hashlib
from ipaddress import ip_address
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

import fitz
import httpx
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.auth import Principal, current_principal, token_from_credentials
from app.config import settings
from app.schemas import BuyerResponseCreate, ClaimCreate, EvidenceResponse, LenderReviewCreate, RegistryReserveRequest, RegistryResponse, RegistryTransitionRequest, VerifyRequest, VerificationResponse
from app.supabase_gateway import gateway
from app.verification import build_arithmetic_findings, extract_claim_documents, finding, persist_findings

app = FastAPI(title="MeiProof Evidence API", version="0.1.0")
# CORS origins come from backend/.env so the local preview can use its active Vite port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip().rstrip("/") for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

DISCLAIMER = "Evidence matching and risk indicators do not prove transaction truth, invoice genuineness, fraud absence, payment certainty, or creditworthiness."
DOCUMENT_TYPES = {"invoice", "purchase_order", "delivery_receipt", "contract", "other"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def participant_role(principal: Principal, claim: dict) -> str | None:
    for role, org_key in (("seller", "seller_organization_id"), ("buyer", "buyer_organization_id")):
        if principal.has_role(role, str(claim[org_key])):
            return role
    assigned = claim.get("assigned_lender_organization_id")
    if assigned and principal.has_role("lender", str(assigned)):
        return "lender"
    return None

async def visible_claim(claim_id: uuid.UUID, principal: Principal, token: str) -> dict:
    claim = await gateway.claim(claim_id, token)
    assignments = await gateway.table("claim_lender_assignments", token=token, select="lender_organization_id", filters={"claim_id": f"eq.{claim_id}"}, limit=10)
    claim["assigned_lender_organization_id"] = assignments[0]["lender_organization_id"] if assignments else None
    if not participant_role(principal, claim):
        raise HTTPException(404, "Claim not found")
    return claim

async def require_org_role(principal: Principal, role: str, organization_id: str) -> None:
    if not principal.has_role(role, organization_id):
        raise HTTPException(403, f"{role} organization membership required")

@app.exception_handler(HTTPException)
async def http_error(_, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": str(exc.status_code), "message": exc.detail}})

@app.get("/health")
async def health():
    return {"status": "ok", "service": "meiproof-backend", "environment": settings.meiproof_env, "demo_mode": settings.demo_mode, "anchoring": {"mode": "disabled", "status": "not_configured"}}

@app.post("/api/demo-login")
async def demo_login(request: Request):
    client_host = request.client.host if request.client else ""
    try:
        client_ip = ip_address(client_host)
        if getattr(client_ip, "ipv4_mapped", None):
            client_ip = client_ip.ipv4_mapped
        is_local_request = client_ip.is_loopback
    except ValueError:
        is_local_request = False
    if not settings.demo_login_available:
        raise HTTPException(503, "Local demo sign-in is not configured.")
    if not is_local_request:
        raise HTTPException(404, "The local demo account is not available.")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password",
                headers={"apikey": settings.public_api_key},
                json={"email": settings.demo_login_email, "password": settings.demo_login_password},
            )
    except httpx.RequestError as error:
        raise HTTPException(503, "The demo account could not reach Supabase Auth.") from error

    if response.status_code != 200:
        raise HTTPException(503, "The configured demo account could not sign in.")

    session = response.json()
    user = session.get("user") or {}
    app_metadata = user.get("app_metadata") or {}
    if (
        str(user.get("id", "")) != settings.demo_login_user_id
        or str(user.get("email", "")).lower() != settings.demo_login_email.lower()
        or app_metadata.get("meiproof_demo") is not True
    ):
        raise HTTPException(503, "The configured Supabase identity is not the MeiProof demo account.")

    return {
        "access_token": session["access_token"],
        "refresh_token": session["refresh_token"],
    }

@app.get("/api/me")
async def me(principal: Annotated[Principal, Depends(current_principal)]):
    return {"user_id": principal.user_id, "email": principal.email, "memberships": list(principal.roles)}

@app.get("/api/organizations")
async def list_organizations(principal: Annotated[Principal, Depends(current_principal)], kind: str = Query("buyer")):
    if kind != "buyer":
        raise HTTPException(422, "Only buyer organizations can be listed here")
    if not principal.has_role("seller"):
        raise HTTPException(403, "Seller organization membership required")
    rows = await gateway.table("organizations", select="id,name,kind", filters={"kind": "eq.buyer"}, order="name.asc", limit=100)
    return {"organizations": rows}

@app.get("/api/claims")
async def list_claims(principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    rows = await gateway.table("claims", token=token, select="id,seller_organization_id,buyer_organization_id,invoice_number,invoice_date,due_date,currency,amount,status,integrity_risk_level,payment_risk_level,created_at,updated_at", order="created_at.desc", limit=200)
    return {"claims": rows, "disclaimer": DISCLAIMER}

@app.post("/api/claims", status_code=201)
async def create_claim(body: ClaimCreate, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    seller_orgs = [item["organization_id"] for item in principal.roles if item["role"] == "seller"]
    if not seller_orgs:
        raise HTTPException(403, "Seller organization membership required")
    if body.currency != body.currency.upper():
        raise HTTPException(422, "Currency must be uppercase ISO format")
    if body.due_date and body.invoice_date and body.due_date < body.invoice_date:
        raise HTTPException(422, "Due date cannot precede invoice date")
    organizations = await gateway.table("organizations", token=None, select="id,kind", filters={"id": f"eq.{body.buyer_organization_id}"}, limit=1)
    if not organizations or organizations[0]["kind"] != "buyer":
        raise HTTPException(422, "Buyer organization is not available")
    payload = body.model_dump(mode="json")
    payload.update({"seller_organization_id": seller_orgs[0], "created_by": principal.user_id, "currency": body.currency.upper(), "status": "submitted", "record_source": "user"})
    rows = await gateway.insert("claims", payload, service=True)
    return {"claim": rows[0], "disclaimer": DISCLAIMER}

@app.get("/api/claims/{claim_id}")
async def get_claim(claim_id: uuid.UUID, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    claim = await visible_claim(claim_id, principal, token)
    documents = await gateway.table("claim_documents", token=token, select="id,document_type,source_type,version_number,sha256_hash,size_bytes,mime_type,created_at", filters={"claim_id": f"eq.{claim_id}"}, order="created_at.desc", limit=100)
    return {"claim": claim, "documents": documents, "disclaimer": DISCLAIMER}

@app.post("/api/claims/{claim_id}/documents", response_model=EvidenceResponse, status_code=201)
async def upload_document(claim_id: uuid.UUID, document_type: str, file: UploadFile = File(...), principal: Annotated[Principal, Depends(current_principal)] = None, token: Annotated[str, Depends(token_from_credentials)] = ""):
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(422, "Unsupported document type")
    claim = await visible_claim(claim_id, principal, token)
    await require_org_role(principal, "seller", str(claim["seller_organization_id"]))
    if file.content_type not in settings.allowed_mime_types:
        raise HTTPException(415, "Unsupported evidence MIME type")
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(413, "Evidence file exceeds the configured 20 MiB limit")
    if file.content_type == "application/pdf":
        try:
            pdf = fitz.open(stream=content, filetype="pdf")
            if pdf.is_encrypted:
                raise HTTPException(422, "Encrypted PDFs are not accepted")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(422, "PDF could not be parsed") from exc
    document_id = uuid.uuid4()
    storage_path = f"{claim_id}/{principal.user_id}/{document_id}"
    await gateway.storage_upload(storage_path, content, file.content_type, token)
    digest = hashlib.sha256(content).hexdigest()
    metadata = {"id": str(document_id), "claim_id": str(claim_id), "uploaded_by": principal.user_id, "original_filename": file.filename or "evidence", "mime_type": file.content_type, "size_bytes": len(content), "storage_path": storage_path, "document_type": document_type, "source_type": "seller_submitted", "version_number": 1, "sha256_hash": digest, "record_source": "user"}
    try:
        rows = await gateway.insert("claim_documents", metadata, token=token, service=False)
    except HTTPException:
        raise
    return EvidenceResponse(id=document_id, document_type=document_type, sha256_hash=digest, extraction_status="pending", signed_url=None, simulated=False)

@app.get("/api/claims/{claim_id}/documents/{document_id}/url")
async def document_url(claim_id: uuid.UUID, document_id: uuid.UUID, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    await visible_claim(claim_id, principal, token)
    rows = await gateway.table("claim_documents", token=token, select="storage_path", filters={"id": f"eq.{document_id}", "claim_id": f"eq.{claim_id}"}, limit=1)
    if not rows:
        raise HTTPException(404, "Document not found")
    return {"signed_url": await gateway.storage_signed_url(rows[0]["storage_path"], token), "expires_in": 300}

@app.post("/api/claims/{claim_id}/buyer-response")
async def buyer_response(claim_id: uuid.UUID, body: BuyerResponseCreate, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    claim = await visible_claim(claim_id, principal, token)
    await require_org_role(principal, "buyer", str(claim["buyer_organization_id"]))
    payload = {"claim_id": str(claim_id), "buyer_organization_id": str(claim["buyer_organization_id"]), "actor_id": principal.user_id, **body.model_dump(), "record_source": "user"}
    rows = await gateway.insert("claim_buyer_responses", payload, token=token, service=False)
    status = {"confirmed": "ready_for_review", "disputed": "disputed", "correction_requested": "needs_review"}[body.response]
    await gateway.request("PATCH", f"{gateway.rest}/claims", token=None, service=True, params={"id": f"eq.{claim_id}"}, json_body={"status": status, "updated_at": now_iso()})
    return {"response": rows[0], "status": status, "simulated": settings.demo_mode, "disclaimer": "Buyer response is separate evidence and is not a guarantee of payment."}

@app.post("/api/claims/{claim_id}/verify", response_model=VerificationResponse)
async def verify_claim(claim_id: uuid.UUID, body: VerifyRequest, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    claim = await visible_claim(claim_id, principal, token)
    documents = await gateway.table("claim_documents", token=token, select="id,document_type,sha256_hash,source_type,storage_path,mime_type", filters={"claim_id": f"eq.{claim_id}"}, limit=100)
    extractions = await extract_claim_documents(claim_id, documents, principal.user_id)
    findings: list[dict] = []
    required = {"invoice", "purchase_order", "delivery_receipt"}
    present = {doc["document_type"] for doc in documents}
    for kind in sorted(required):
        findings.append(finding(f"EVIDENCE_{kind.upper()}", "pass" if kind in present else "missing", "none" if kind in present else "high", f"{kind.replace('_', ' ')} evidence {'present' if kind in present else 'missing'}.", "Continue review" if kind in present else "Request the missing evidence"))
    findings.append(finding("BUYER_RESPONSE", "pass" if claim["status"] == "ready_for_review" else "warning", "none" if claim["status"] == "ready_for_review" else "medium", "Latest buyer response is represented by the current claim state.", "Review the buyer response before financing"))
    line_items = await gateway.table("claim_line_items", token=token, select="line_number,quantity,unit_price,line_amount", filters={"claim_id": f"eq.{claim_id}"}, order="line_number.asc", limit=500)
    arithmetic_findings, integrity = build_arithmetic_findings(claim, extractions, line_items)
    findings.extend(arithmetic_findings)
    payment = await gateway.table("buyer_payment_risk_assessments", token=token, select="risk_level,methodology,explanation,source_coverage,created_at", filters={"claim_id": f"eq.{claim_id}"}, order="created_at.desc", limit=1)
    payment_risk = payment[0] if payment else {"risk_level": "unknown", "methodology": "not evaluated", "explanation": {"message": "No payment-risk assessment is available."}, "source_coverage": []}
    summary = {"finding_count": len(findings), "pass_count": sum(1 for item in findings if item["result"] == "pass"), "disclaimer": DISCLAIMER}
    run_rows = await gateway.insert("verification_runs", {"claim_id": str(claim_id), "ruleset": body.ruleset, "ruleset_version": "1", "status": "completed", "summary": summary, "created_by": principal.user_id, "record_source": "system", "started_at": now_iso(), "completed_at": now_iso()}, service=True)
    run = run_rows[0]
    await persist_findings(run, claim_id, findings)
    await gateway.insert("risk_assessments", {"claim_id": str(claim_id), "transaction_integrity_level": integrity, "methodology": "ocr-and-cross-document-arithmetic", "methodology_version": "1", "explanation": {"message": "This is an evidence-integrity indicator, not a truth determination.", "ocr_engines": sorted({item["result"].engine for item in extractions})}, "source_coverage": sorted(present), "record_source": "system"}, service=True)
    await gateway.request("PATCH", f"{gateway.rest}/claims", token=None, service=True, params={"id": f"eq.{claim_id}"}, json_body={"integrity_risk_level": integrity, "updated_at": now_iso()})
    return VerificationResponse(verification_run=run, findings=findings, transaction_integrity={"level": integrity, "simulated": True}, payment_risk={**payment_risk, "simulated": True})

@app.post("/api/claims/{claim_id}/extract")
async def extract_claim(claim_id: uuid.UUID, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    await visible_claim(claim_id, principal, token)
    documents = await gateway.table("claim_documents", token=token, select="id,document_type,sha256_hash,storage_path,mime_type", filters={"claim_id": f"eq.{claim_id}"}, limit=100)
    results = await extract_claim_documents(claim_id, documents, principal.user_id)
    return {"claim_id": str(claim_id), "documents": [{"document_id": item["document"]["id"], "status": item["result"].status, "engine": item["result"].engine, "field_count": len(item["result"].fields), "error_code": item["result"].error_code, "error_summary": item["result"].error_summary} for item in results], "disclaimer": "OCR output is machine-generated evidence with provenance and confidence; it requires human review."}

@app.get("/api/claims/{claim_id}/duplicates")
async def duplicates(claim_id: uuid.UUID, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    claim = await visible_claim(claim_id, principal, token)
    matches = await gateway.table("claims", token=None, select="id", filters={"seller_organization_id": f"eq.{claim['seller_organization_id']}", "buyer_organization_id": f"eq.{claim['buyer_organization_id']}", "invoice_number": f"ilike.{claim['invoice_number']}", "id": f"neq.{claim_id}"}, limit=50)
    return {"scope": "participating MeiProof records only", "candidates": [{"basis": "normalized_invoice_identity", "opaque_claim_reference": row["id"]} for row in matches], "disclaimer": "A duplicate candidate is not a fraud finding and does not cover lenders outside this registry."}

@app.post("/api/claims/{claim_id}/registry/reserve", response_model=RegistryResponse)
async def reserve_registry(claim_id: uuid.UUID, body: RegistryReserveRequest, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    claim = await visible_claim(claim_id, principal, token)
    await require_org_role(principal, "lender", str(body.lender_organization_id))
    if claim.get("assigned_lender_organization_id") != str(body.lender_organization_id):
        raise HTTPException(404, "Claim not found")
    result = await gateway.rpc("reserve_claim", {"target_claim_id": str(claim_id), "target_lender_organization_id": str(body.lender_organization_id), "reservation_hours": body.reservation_hours}, token)
    row = result[0] if isinstance(result, list) and result else result
    outcome = row.get("outcome", "error") if isinstance(row, dict) else "error"
    if outcome == "conflict":
        return RegistryResponse(outcome=outcome, message="A participating registry conflict was found; details are restricted.", simulated=settings.demo_mode)
    if outcome != "reserved":
        raise HTTPException(409, "Claim is not eligible for a participating-registry reservation")
    return RegistryResponse(outcome=outcome, reservation_id=row.get("reservation_id"), message="Reservation created in the participating MeiProof registry.", simulated=settings.demo_mode)

@app.post("/api/registry/{reservation_id}/transition")
async def transition_registry(reservation_id: uuid.UUID, body: RegistryTransitionRequest, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    if not principal.has_role("lender"):
        raise HTTPException(403, "Lender role required")
    result = await gateway.rpc("transition_claim_reservation", {"target_reservation_id": str(reservation_id), "next_status": body.next_status, "next_financed_amount": str(body.financed_amount) if body.financed_amount is not None else None, "transition_note": body.note}, token)
    status = result[0] if isinstance(result, list) and result else result
    if status in {"not_authorized", "invalid_transition", "invalid_amount"}:
        raise HTTPException(409, "Registry transition rejected")
    return {"status": status, "simulated": settings.demo_mode, "scope": "participating MeiProof registry only"}

@app.post("/api/claims/{claim_id}/lender-review")
async def lender_review(claim_id: uuid.UUID, body: LenderReviewCreate, principal: Annotated[Principal, Depends(current_principal)], token: Annotated[str, Depends(token_from_credentials)]):
    claim = await visible_claim(claim_id, principal, token)
    assigned = claim.get("assigned_lender_organization_id")
    if not assigned or not principal.has_role("lender", str(assigned)):
        raise HTTPException(404, "Claim not found")
    rows = await gateway.insert("claim_lender_reviews", {"claim_id": str(claim_id), "lender_organization_id": assigned, "actor_id": principal.user_id, **body.model_dump(), "record_source": "user"}, token=token, service=False)
    return {"review": rows[0], "simulated": settings.demo_mode, "disclaimer": "A lender review records a human decision; it does not initiate disbursement."}
