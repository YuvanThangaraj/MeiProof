# MeiProof — Updated Cross-Verified MVP Specification
**Hackathon:** Synesis 26  
**Problem statement:** Invoice Financing with Hybrid Audit Architecture  
**Version:** 2.0 — includes shared-registry double-financing detection  
**Purpose:** A practical, evidence-based invoice-verification and financing-risk prototype.

---

## 1. Executive Summary

**Product name:** MeiProof (replace all previous InvoiceShield branding). Use the exact capitalization `MeiProof` consistently across UI, documentation, demo data, page titles, navigation, and presentation materials. This is a rename only; all product scope, controls, and limitations remain unchanged.


MeiProof is an invoice-financing verification platform that helps a lender assess an unpaid business invoice before deciding whether to finance it.

It is not merely an invoice-storage dashboard and it is not an autonomous bank. It combines:

1. Document data extraction.
2. Cross-document consistency checks.
3. Duplicate-claim detection within available records.
4. A shared demo financing registry to detect possible double financing across participating demo lenders.
5. Independent buyer confirmation and evidence provenance.
6. Explainable buyer-payment and receivables risk indicators.
7. Private document storage and tamper-evident audit records.
8. Actual blockchain testnet anchoring of document/audit hashes.
9. A human lender-review workflow.

**Core product principle:** Matching documents does not prove that a real transaction occurred. MeiProof must distinguish between documents that agree and claims supported by independently corroborated evidence.

**Double-financing principle:** A repeated upload and double financing are related but different. A file can be renamed or reformatted, and the same receivable can be submitted to two different lenders. Detecting double financing across lenders requires a shared registry or trusted external integration. Our demo will use a shared registry inside MeiProof and must clearly state that it does not cover lenders outside that registry.

The prototype should be built around synthetic data and must clearly label simulated buyer confirmation and synthetic payment histories as demonstrations, not real-world verification.

---

## 2. The Original Problem Statement

The Synesis 26 problem statement says that small and medium-sized businesses can face cash-flow constraints because customer payments take weeks or months to arrive. Lenders must establish that an invoice is genuine, goods or services were delivered, the buyer is likely to pay, and the invoice has not been financed elsewhere. Fragmented documents and manual checks can lead to duplicate financing, manipulated invoices, delayed approvals, and disputes.

The challenge is to develop an intelligent invoice-financing platform that evaluates invoice authenticity, assesses financing risk, identifies potential duplication, and maintains a verifiable history of important events through a hybrid audit architecture.

The brief suggests:
- Invoice data extraction from uploaded documents.
- Cross-checks against purchase orders, delivery receipts, and contracts.
- Duplicate invoice detection across repeated submissions.
- Financing risk assessment from buyer payment history and receivables.
- Hybrid audit: off-chain files with tamper-evident on-chain hashes.
- Explainable verification and an automated financing workflow.

The goal is a working prototype that automates verification, detects duplicate or inconsistent claims, supports risk-based financing decisions, and maintains a tamper-evident audit history without exposing sensitive documents unnecessarily.

---

## 3. Product Goals and Non-Goals

### Goals
- Reduce repetitive manual checking of invoice claims.
- Show mismatches and missing evidence with clear explanations.
- Flag possible duplicate claims within the system's available records.
- Detect potential double financing across participating lenders in the shared demo registry.
- Keep document-source provenance visible.
- Obtain buyer confirmation through a separate role-based workflow.
- Use buyer payment history and receivables data to provide explainable risk indicators.
- Maintain file-integrity checks and an auditable event history.
- Demonstrate a real on-chain hash anchor on a blockchain testnet.
- Keep the lender in control of the financing decision.

### Non-goals for this hackathon
- Lending money or disbursing funds.
- Proving every invoice is genuine.
- Detecting every AI-generated or manipulated document.
- Detecting duplicate financing at every lender globally.
- Building a full KYC/AML platform.
- Integrating every bank, accounting provider, logistics company, or government service.
- Training a custom machine-learning model.
- Replacing regulated invoice-financing or TReDS platforms.
- Claiming production-grade credit underwriting.

---

## 4. Authentication, Login, and Role-Based Access

Authentication is an explicit MVP requirement because sellers, buyers, and lenders must perform different actions and must not be able to impersonate one another.

### Login page
Build a clean, responsive MeiProof login page with:
- Email and password fields.
- Sign-in button and validation/error states.
- Loading and authentication-failure states.
- A logout action once signed in.
- Consistent branding with the rest of the fintech dashboard.

Use **Supabase Auth** for email/password authentication rather than implementing password handling from scratch.

### MVP roles and dashboards
- **Seller:** submit claims, upload supporting documents, view verification findings, and track claim status.
- **Buyer:** view claims addressed to that buyer and confirm, dispute, or request correction.
- **Lender:** review verification findings and payment-risk indicators, check the shared financing registry, reserve eligible claims, and record lender-review decisions.

After authentication, route the user to the dashboard for their assigned role. Do not let a user choose an arbitrary role in the UI and thereby gain permissions.

### Demo accounts
Prepare three preconfigured demo accounts—one seller, one buyer, and one lender—for the hackathon presentation. Keep credentials in the team's private setup notes or environment configuration; do not hard-code passwords into frontend source code or commit them to the repository. If account provisioning is not ready, provide a clearly labelled, development-only demo sign-in path that cannot be enabled in production.

### Authorization and data isolation
- Protect authenticated pages and API endpoints.
- Enforce role permissions in the backend and Supabase Row Level Security (RLS) policies; frontend route guards alone are not security.
- Sellers must not be able to submit buyer confirmations.
- Buyers must not confirm invoices assigned to unrelated buyers.
- Lenders must not be able to impersonate other lenders or see restricted lender-specific data.
- Keep the Supabase service-role key on the backend only.
- Provide logout and clear session handling.

### Out of scope unless time remains
- Public self-service registration.
- Social login.
- Custom password-reset flows.
- Email verification UI customization.
- Multi-factor authentication.

### Authentication acceptance tests
- [ ] A seller can sign in and reach the seller dashboard.
- [ ] A buyer can sign in and reach the buyer dashboard.
- [ ] A lender can sign in and reach the lender dashboard.
- [ ] An unauthenticated user cannot access protected dashboards or APIs.
- [ ] A seller cannot perform buyer-confirmation actions.
- [ ] A buyer cannot confirm a claim belonging to a different buyer.
- [ ] A lender cannot use another lender's identity to reserve or finance a claim.
- [ ] Logout ends the authenticated session.

---

## 4. Real-World Context and Design Implications

### 4.1 Buyer confirmation
A separate buyer-confirmation workflow is a useful design reference. India's RBI-regulated TReDS process includes acceptance of a factoring unit by the counterparty before financiers bid.

**Design implication:** the seller must not be able to mark their own invoice as independently confirmed. The buyer should respond through a separately authenticated role.

For the demo, buyer confirmation may be simulated through a separate buyer portal, but it must be labelled as simulated. Production use would require trustworthy buyer identity verification and a secure confirmation channel.

Reference: RBI TReDS FAQs — https://www.rbi.org.in/scripts/FAQView.aspx/FAQView.aspx/FAQView.aspx?Id=132

### 4.2 Duplicate-financing detection
Duplicate detection inside a single database is not the same as detecting financing at unrelated lenders. Public work in trade finance has explored duplicate-invoice detection across participating institutions, including privacy-preserving approaches.

**Design implication:** MeiProof can detect repeated claims within its own records and across demo lenders using the same shared registry. Cross-lender detection in production requires a shared registry, participating institutions, or trusted integrations. The prototype must not claim universal detection.

Reference: BIS material on the fintech journey and duplicate financing concepts — https://www.bis.org/speeches/20171115-singapore-fintech-journey-20

### 4.3 Blockchain and hashes
A hash stored only in PostgreSQL is not an on-chain audit architecture. A real hybrid audit implementation must submit a hash or hash manifest to a blockchain network and retain a verifiable transaction reference.

A cryptographic hash can help detect changes to a previously recorded file. It does not prove that the file was truthful when it was first uploaded.

Blockchain does not automatically solve double financing. A second claim that never reaches the same registry/network cannot be detected by that registry. The shared registry performs the duplicate/reservation check; the blockchain makes a selected record or event hash independently checkable.

References:
- NIST Secure Hash Standard — https://www.nist.gov/publications/secure-hash-standard
- Ethereum smart-contract deployment — https://ethereum.org/developers/docs/smart-contracts/deploying/

### 4.4 Indian GST e-invoice evidence
For applicable GST e-invoices, an Invoice Registration Number (IRN) and QR code can provide a path to checking registered invoice details. This does not independently prove physical delivery, buyer acceptance, buyer repayment ability, or absence of financing at another lender.

**Design implication:** treat GST/e-invoice verification as a later optional integration unless a working authorized verification path is available. Do not claim a live GST integration unless it is actually implemented and tested.

Reference: GST e-Invoice portal — https://einvoice3.gst.gov.in/

### 4.5 Private document storage
Supabase Storage supports private buckets and access policies. Correct access controls are required; a private bucket alone is not a complete security design.

Reference: Supabase Storage access control — https://supabase.com/docs/guides/storage/security/access-control

---

## 5. The Central Fraud Problem

A fraudster could create:
- A fake invoice for ₹10,00,000.
- A fake purchase order for ₹10,00,000.
- A fake delivery receipt claiming the goods were delivered.

If all three documents are fabricated consistently, simple cross-document matching can pass them. Hashing those files only records their fingerprints; it does not establish that the transaction was real.

A separate but related risk is **double financing**: a seller submits or sells the same receivable to more than one lender. The system must distinguish exact duplicate files, repeated claims, and potential duplicate financing across lenders.

### What each control can and cannot do

| Control | What it can help with | What it cannot prove |
|---|---|---|
| Cross-document checks | Find inconsistencies and missing evidence | That matching documents describe a real transaction |
| SHA-256 hash | Detect whether a file differs from the recorded version; find exact byte-for-byte duplicate files | That the file was genuine at upload time or that the invoice has not been financed elsewhere |
| Normalized invoice matching | Flag repeated invoice identities even if the PDF is renamed or re-exported | Detect a claim at an institution outside the available registry |
| Shared financing registry | Detect matching claims registered by participating lenders; reserve a claim to reduce race conditions | See claims from lenders that do not participate |
| Blockchain anchor | Make a recorded hash independently checkable | That the underlying transaction is truthful or that all lenders use the registry |
| AI document analysis | Flag some anomalies and suspicious patterns | Reliably identify every fake or AI-generated document |
| Buyer confirmation | Add evidence from a separate transaction party | Trustworthiness if buyer identity/channel is not verified |
| Independent delivery evidence | Corroborate shipment or receipt when the source is trustworthy | Buyer solvency or absence of all other financing |

### Product principle
The system should answer:
- Who supplied this evidence?
- What checks were performed?
- Which independent sources corroborated the claim?
- Has the claim been registered, reserved, or financed by another participating lender?
- What remains unverified?
- Why was the claim routed to review, dispute, or investigation?

It should not simply answer “AI says genuine.”

---

## 6. End-to-End User Workflow

### Step 1 — Seller submits a claim
The seller uploads:
- Invoice.
- Purchase order (PO).
- Delivery receipt or proof of delivery.
- Relevant contract, when available.

The original files are stored in a private bucket.

### Step 2 — Extract document fields
Extract the relevant fields:
- Invoice number and date.
- Seller and buyer identities.
- Currency and total amount.
- Line items and quantities.
- Purchase-order reference.
- Payment terms and due date.
- Delivery references, where present.

Use PyMuPDF for ordinary text-based PDFs. Scanned PDFs may need OCR. An LLM can assist with irregular layouts, but extracted fields must be shown for human correction when uncertain.

### Step 3 — Cross-check the documents
Compare the invoice with the PO, contract, and delivery receipt. Check:
- Seller and buyer mismatch.
- Invoice amount versus PO/contract amount.
- Quantity or line-item discrepancies.
- Missing supporting documents.
- Invalid or inconsistent dates and payment terms.
- Repeated invoice identifiers and suspicious duplicate claims.

Every finding should show the rule, severity, evidence, and recommended next action.

### Step 4 — Detect duplicate claims
Use multiple levels:
1. Exact SHA-256 file-hash match.
2. Normalized supplier + buyer + invoice number match.
3. Supplier + buyer + amount + date/reference similarity as a secondary warning.

A re-exported or renamed PDF may have a different file hash, so file hashing alone is not enough. Similarity-based matching can flag candidates for review but should not automatically label every similar invoice as fraud.

### Step 5 — Check the shared financing registry
Before the lender proceeds, check whether a matching invoice claim already exists in the registry.

Registry matching should use a normalized identity, at minimum:
- Supplier identity/reference.
- Buyer identity/reference.
- Invoice number.
- Currency and amount.
- Invoice date and, if available, purchase-order/reference number.

Use exact matching first and candidate/similarity matching for possible variants. Do not expose another lender's confidential data unnecessarily; the demo can show a generic warning and a permitted reference rather than revealing private details.

Suggested registry states:
- `Submitted`
- `Under Review`
- `Reserved`
- `Financed`
- `Partially Financed`
- `Repaid`
- `Released`
- `Disputed`
- `Rejected`

**Important concurrency rule:** two lenders might check at the same time and both see that a claim is available. The shared registry should use an atomic reservation/unique constraint or transaction so only one competing claim can reserve the same invoice identity at a time. Recheck before finalizing financing.

For the demo, implement this within one shared database and simulate two lender accounts. This demonstrates cross-lender detection only within the demo registry.

### Step 6 — Obtain independent confirmation
A separate buyer role can:
- Confirm the invoice.
- Dispute the invoice.
- Request a correction.

Record the responding actor, timestamp, response, and any explanation. For the hackathon, use clearly labelled simulated buyer accounts.

Independent delivery-provider, accounting-system, or official e-invoice checks can be future integrations. Do not describe seller-uploaded evidence as independently verified.

### Step 7 — Assess financing risk
Show two separate assessments rather than blending everything into one opaque score.

**A. Transaction integrity risk**
- Document inconsistencies.
- Duplicate claim indicators.
- Shared-registry match/reservation/financing status.
- Buyer confirmation status.
- Delivery evidence status.
- File-integrity status.

**B. Buyer payment risk**
- Historical on-time payment rate.
- Average payment delay.
- Overdue receivables.
- Outstanding balances.
- Exposure to the buyer.

Use synthetic payment history and transparent deterministic rules. Label the score illustrative and unvalidated. No custom-trained ML model is needed.

### Step 8 — Record the audit trail
Record uploads, extraction, verification results, registry checks/reservations, buyer responses, status changes, reviewer actions, hash anchoring, and final lender review.

### Step 9 — Lender review
The lender sees the evidence and remaining concerns and can:
- Request more evidence.
- Hold or investigate the claim.
- Reject the claim.
- Mark it ready for financing consideration.

The prototype does not need to disburse money. “Ready for lender review” is not the same as “loan approved.”

---

## 7. Verification and Financing Status Models

### Claim verification statuses
| Status | Meaning |
|---|---|
| `Documents Matched` | Submitted fields agree with one another |
| `Pending Buyer Confirmation` | Independent buyer confirmation has not been obtained |
| `Evidence Corroborated` | The specified independent checks passed |
| `Duplicate Suspected` | A similar or repeated claim exists in available records |
| `Disputed` | The buyer disputes the invoice or transaction |
| `Needs Investigation` | Material discrepancies, missing evidence, or suspicious signals remain |
| `Ready for Lender Review` | Required checks passed; a lender must still decide whether to finance |
| `Rejected` | A reviewer rejected the claim, with a recorded reason |

### Shared registry financing statuses
| Status | Meaning |
|---|---|
| `Submitted` | Claim has been registered but is not yet reserved or financed |
| `Under Review` | A lender is reviewing the claim |
| `Reserved` | A lender has temporarily reserved the claim while finalizing a decision |
| `Financed` | The registry records financing against the claim |
| `Partially Financed` | Only a portion of the eligible receivable is recorded as financed |
| `Repaid` | The financing has been repaid according to the recorded workflow |
| `Released` | A reservation was cancelled or released |
| `Disputed` | A dispute is active |
| `Rejected` | The claim was rejected |

Never automatically translate `Documents Matched` into `Genuine`. Registry state must also not be confused with a legal determination of ownership; the prototype is a workflow demonstration, not a legal registry.

---

## 8. Financing-Risk Engine

Keep transaction-integrity risk and buyer-payment risk distinct.

### Transaction-integrity indicators
- Supplier or buyer mismatch.
- Amount or quantity mismatch.
- Missing PO, contract, or delivery evidence.
- Buyer confirmation pending or disputed.
- Duplicate claim candidate.
- Shared registry indicates reserved, financed, or partially financed.
- File hash no longer matches its recorded version.
- Audit anchoring pending or failed.

### Buyer-payment indicators
- Percentage of invoices paid on time.
- Average days late.
- Total overdue receivables.
- Outstanding amount.
- Exposure concentration to the buyer.

Use explainable rules and show the reason for each grade. Example:

> **Elevated payment risk:** 4 of the last 10 invoices were paid late, and overdue receivables total ₹3,20,000.

This should be generated from seeded synthetic data for the demo. Do not present a hand-designed score as a validated default-prediction model.

---

## 9. Hybrid Audit Architecture

### Required concept
- **Off-chain:** original documents stay in private file storage.
- **On-chain:** a hash or hash manifest is anchored on a real blockchain network.
- **Audit record:** the app retains the chain/network, contract, transaction hash, and block reference.
- **Shared registry:** performs the live duplicate/reservation checks; blockchain anchors help make selected registry/audit events tamper-evident.

### Recommended sequence
1. Receive a document.
2. Compute SHA-256 over the exact original bytes.
3. Store the file privately and record the hash in PostgreSQL.
4. Build a deterministic manifest containing the claim identifier, document hashes, and relevant version metadata. Do not include sensitive document contents.
5. Hash the manifest.
6. Submit that hash to a deployed testnet contract.
7. Save the transaction hash, chain ID, contract address, and block number.
8. Record a registry event when a claim is reserved or financed.
9. At review completion, create and anchor a separate hash for the final audit/decision record if time permits.
10. To verify integrity later, retrieve the original file, recalculate the hash, and compare it with the recorded hash. Verify the manifest anchor against the chain.

### Important limitations
- A matching hash means the bytes match the recorded version; it does not prove the contents are true.
- A public-chain timestamp is not proof of when the underlying real-world transaction happened.
- A privileged actor who can replace a file and its database hash before anchoring may hide changes; access controls and anchoring discipline matter.
- Do not put invoices, names, tax identifiers, or other confidential contents directly on a public blockchain.
- A Supabase-only hash log is not equivalent to an on-chain anchor.
- Blockchain does not detect a second financing claim that never enters the same network/registry.

**Acceptance criterion:** a real testnet transaction is visible in a block explorer and the app stores its transaction reference. If the team cannot achieve that, disclose the limitation rather than claiming the hybrid audit requirement is complete.

---

## 10. Technical Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React + TypeScript + Vite | Dashboard, upload workflow, buyer portal, lender review |
| UI | Tailwind CSS + shadcn/ui | Consistent responsive interface |
| Backend | Python + FastAPI | Extraction, verification, risk logic, registry operations, audit |
| Authentication | Supabase Auth | Email/password login and session management for seller, buyer, and lender roles |\n| Database | Supabase PostgreSQL | Claims, extracted fields, checks, registry, payment history, events |
| File storage | Supabase private Storage | Original documents and evidence |
| PDF extraction | PyMuPDF | Text-based PDF extraction |
| Optional AI/OCR | OCR library and/or Gemini vision-capable API | Scanned or irregular documents |
| File integrity | SHA-256 | Fingerprints of original files |
| Blockchain | Small testnet smart contract | Anchoring hashes or emitting hash events |
| Frontend hosting | Vercel | Web UI |
| Backend hosting | Python-compatible host | FastAPI API |

### Extraction design
Use deterministic parsing and validation for structured fields whenever possible. Use AI to help interpret irregular layouts, not to make the final fraud or financing decision. Treat extracted data as untrusted until checked.

PyMuPDF alone is not a complete OCR solution for scanned image PDFs. Limit the first demo to text PDFs or add OCR only if time allows.

### Security basics
- Use a private storage bucket.
- Configure Supabase row-level security and storage access policies.
- Keep the service-role key only on the backend.
- Validate file type and size; do not trust a filename or MIME type alone.
- Restrict endpoints by authenticated role.
- Avoid logging document contents or sensitive identifiers unnecessarily.
- Keep secrets out of source control.
- Make reviewer decisions and audit events attributable to an actor.
- Do not silently overwrite the original file or its original hash.
- Ensure registry reservation is atomic and enforce unique constraints for active reservations/financing claims.
- Do not reveal another lender's confidential claim details to unauthorized users.

---

## 11. Minimal Data Model

### `invoice_claims`
Suggested fields:
- `id`
- `seller_id`
- `buyer_id`
- `invoice_number`
- `invoice_date`
- `currency`
- `invoice_amount`
- `due_date`
- `status`
- `integrity_risk_level`
- `payment_risk_level`
- `created_at`

### `documents`
Suggested fields:
- `id`
- `claim_id`
- `document_type`
- `storage_path`
- `sha256_hash`
- `extracted_fields` (JSON)
- `source_type` (seller-provided, buyer-confirmed, independently verified)
- `uploaded_by`
- `uploaded_at`

### `verification_checks`
Suggested fields:
- `id`
- `claim_id`
- `rule_code`
- `result`
- `severity`
- `evidence_summary`
- `recommended_action`
- `created_at`

### `buyer_confirmations`
Suggested fields:
- `id`
- `claim_id`
- `buyer_actor_id`
- `response`
- `comment`
- `responded_at`
- `demo_or_verified_source`

### `buyer_payment_history`
Suggested fields:
- `id`
- `buyer_id`
- `invoice_reference`
- `amount`
- `due_date`
- `paid_date`
- `outstanding_amount`

### `financing_registry`
Suggested fields:
- `id`
- `claim_id`
- `normalized_invoice_key`
- `seller_reference`
- `buyer_reference`
- `invoice_number_normalized`
- `currency`
- `invoice_amount`
- `invoice_date`
- `purchase_order_reference`
- `lender_id`
- `registry_status`
- `reserved_at`
- `reservation_expires_at`
- `financed_amount`
- `created_at`
- `updated_at`

Use a normalized invoice identity/key for matching, but do not rely on a single key as conclusive proof. Keep candidate-match evidence. Add a database transaction or equivalent atomic operation to prevent two demo lenders from reserving the same active claim simultaneously.

### `audit_events`
Suggested fields:
- `id`
- `claim_id`
- `actor_id`
- `event_type`
- `event_payload`
- `previous_event_hash`
- `event_hash`
- `created_at`

### `chain_anchors`
Suggested fields:
- `id`
- `claim_id`
- `anchor_type` (submission manifest, registry event, or final review)
- `manifest_hash`
- `chain_id`
- `contract_address`
- `transaction_hash`
- `block_number`
- `anchored_at`
- `verification_status`

These are suggested MVP fields, not a final production schema. Use foreign keys, indexes, constraints, and role-based access policies when implementing them.

---

## 12. Suggested API Endpoints

- `POST /api/claims` — create a claim.
- `POST /api/claims/{id}/documents` — upload a document and compute its hash.
- `POST /api/claims/{id}/verify` — run extraction and verification checks.
- `GET /api/claims` — list claims with status filters.
- `GET /api/claims/{id}` — retrieve a claim and its findings.
- `POST /api/claims/{id}/buyer-response` — confirm, dispute, or request correction as an authenticated buyer.
- `GET /api/claims/{id}/risk` — retrieve integrity and payment-risk explanations.
- `POST /api/claims/{id}/registry-check` — check for exact and potential matches in the shared financing registry.
- `POST /api/claims/{id}/reserve` — atomically reserve an available claim for a lender review/financing workflow.
- `POST /api/claims/{id}/registry-status` — record a permitted status transition such as financed, repaid, or released.
- `POST /api/claims/{id}/review` — record a lender-review action.
- `GET /api/claims/{id}/audit` — retrieve audit events and chain anchors.
- `POST /api/claims/{id}/anchor` — create and submit a manifest hash to the blockchain.
- `GET /api/health` — health check.

Authorization must be enforced server-side. A frontend role selector alone is not access control. Registry reservation and status transitions must be validated by the backend and database.

---

## 13. Six-Hour Implementation Plan

### First 30 minutes — Prove the blockchain path
- Deploy a minimal hash-anchor contract to a suitable testnet.
- Submit a test hash.
- Confirm the transaction in a block explorer.
- Save the chain ID, contract address, and transaction reference.
- Resolve wallet/RPC/setup issues immediately rather than at the end.

### 30–90 minutes — Core app and database
- Create Supabase tables and private storage.
- Implement demo role-based access.
- Build the claim list and document upload.
- Seed several synthetic claims and a shared financing registry.
- Seed two demo lender accounts.

### 90–180 minutes — Verification engine
- Extract fields from supported PDFs.
- Compare invoice, PO, contract, and delivery receipt.
- Add duplicate detection across exact hashes and normalized fields.
- Return evidence-backed findings with explanations.

### 180–240 minutes — Registry, buyer confirmation and risk
- Implement buyer confirm/dispute actions.
- Implement shared registry check and atomic reservation.
- Demonstrate Lender A registering/financing a claim and Lender B being blocked/flagged for the same claim.
- Seed synthetic buyer payment history.
- Add receivables and payment-risk indicators.
- Record audit events for each action.

### 240–300 minutes — Audit integration
- Hash original documents.
- Build and anchor the submission manifest.
- Store the transaction reference.
- Anchor a registry event or final review manifest if time permits.

### 300–360 minutes — Test and rehearse
- Run clean, inconsistent, duplicate, unconfirmed, disputed, and cross-lender duplicate-financing scenarios.
- Check authorization and storage access.
- Verify hashes and the testnet transaction.
- Fix broken flows and rehearse the pitch.

**Scope rule:** do not let OCR, a Gemini integration, or decorative analytics delay the complete working workflow. Start with text-based PDFs and deterministic rules.

---

## 14. Demo Scenarios

### Scenario A — Consistent claim with confirmation
- Invoice, PO, contract, and delivery fields agree.
- Buyer confirms through the demo portal.
- Synthetic payment history shows acceptable payment behaviour.
- Audit hashes are anchored.

**Expected outcome:** `Ready for Lender Review`, with the evidence and risk explanations visible.

### Scenario B — Three matching fabricated documents
- All seller-uploaded documents agree perfectly.
- Buyer confirmation is outstanding.
- No independently verified delivery evidence is available.

**Expected outcome:** `Pending Buyer Confirmation`. The system must not label the invoice genuine merely because the files match.

### Scenario C — Document inconsistency
- Invoice amount differs from the PO or contract.
- Delivery quantity is lower than the invoice quantity.

**Expected outcome:** `Needs Investigation`, with exact mismatches and recommended action.

### Scenario D — Duplicate claim with a renamed PDF
- Submit the same claim again with a renamed or re-exported PDF.
- The file hash may differ, but normalized invoice identifiers and supplier/buyer fields match.

**Expected outcome:** `Duplicate Suspected`, linked to the earlier claim.

### Scenario E — Double financing across demo lenders
- Lender A registers the claim and reserves or records it as financed.
- Lender B submits the same invoice, potentially using a renamed PDF.
- The shared registry matches the normalized invoice identity.
- Lender B receives a duplicate-financing warning and the claim is held for investigation.
- The registry event is recorded in the audit log; its hash can be anchored on-chain.

**Expected outcome:** the second claim is blocked or held by the shared demo registry. This demonstrates detection only among participating demo lenders, not every lender globally.

### Scenario F — Concurrent reservation attempt
- Two demo lenders attempt to reserve the same invoice at nearly the same time.

**Expected outcome:** an atomic database reservation allows at most one active reservation. The other attempt receives an unavailable/already-reserved result.

### Scenario G — Buyer dispute
- Buyer disputes the invoice or denies receipt.
- A dispute event is recorded.

**Expected outcome:** `Disputed`, held for review, with the buyer response in the audit trail.

### Scenario H — File tampering
- Modify an uploaded file after its original hash is recorded.
- Recalculate the hash.

**Expected outcome:** integrity mismatch; the file does not match the recorded version.

---

## 15. Acceptance Checklist

The MVP is not finished until these tests pass:

- [ ] Matching synthetic documents produce a clear cross-check report.
- [ ] Amount and quantity discrepancies are flagged with explanations.
- [ ] Repeated invoices are detected using normalized fields, not only file hashes.
- [ ] Matching documents cannot bypass outstanding buyer confirmation.
- [ ] A buyer dispute puts the claim on hold and records an event.
- [ ] Different payment histories change the risk indicators and explanations.
- [ ] A modified file produces a hash mismatch.
- [ ] Lender A's financed claim is detected when Lender B submits the same invoice in the shared registry.
- [ ] The double-financing test still works if the second PDF is renamed or re-exported.
- [ ] Concurrent reservation attempts cannot both successfully reserve the same invoice.
- [ ] A real blockchain testnet transaction is visible in a block explorer.
- [ ] The transaction reference is stored and shown in the audit view.
- [ ] The lender can record a review decision.
- [ ] The interface does not claim that money was disbursed or that fraud was conclusively proven.
- [ ] The frontend cannot access backend secrets.
- [ ] Seller, buyer, and lender actions are restricted by server-side authorization.\n- [ ] Login, role-based redirects, protected pages, and logout work for all three demo roles.
- [ ] The UI clearly states that cross-lender detection is limited to the shared demo registry.

---

## 16. What Not to Claim in the Pitch

| Avoid saying | Say instead |
|---|---|
| “AI detects every fake invoice.” | “We flag inconsistencies and uncorroborated claims.” |
| “We prevent all duplicate financing globally.” | “We detect duplicates among claims in our shared demo registry and can integrate with a broader registry.” |
| “Blockchain proves the invoice is genuine.” | “Blockchain makes the recorded hashes independently verifiable.” |
| “A buyer account proves the buyer is real.” | “The demo simulates a separate buyer workflow; production needs verified identity.” |
| “Our score predicts default accurately.” | “We demonstrate explainable risk indicators using synthetic data.” |
| “We automatically approve and pay loans.” | “We support lender review; the prototype does not disburse funds.” |
| “This replaces TReDS or a bank.” | “This is a prototype verification and audit layer, not a regulated financing platform.” |

---

## 17. Suggested Pitch

> **MeiProof is an evidence-based invoice-financing verification platform. It extracts and cross-checks invoice data against purchase orders, contracts, and delivery evidence; flags repeated claims; checks a shared financing registry for potential double financing across participating lenders; gathers buyer confirmation; and presents explainable transaction-integrity and payment-risk indicators. Original documents remain off-chain while cryptographic hashes are anchored on a blockchain testnet, giving reviewers a verifiable record of submitted evidence and important decisions. Our goal is to make invoice verification more transparent, auditable, and efficient—without treating matching documents as proof of a genuine transaction or claiming visibility into lenders outside our registry.**

### The product's core differentiator
A basic invoice app stores documents. MeiProof connects the evidence, identifies what is still uncertain, checks whether participating demo lenders have already registered or financed the same claim, explains the risk, and preserves a verifiable audit trail.

---

## 18. Final Recommendation

Commit to this MVP and stop adding features until the core workflow passes its tests.

Prioritize:
1. A working document-verification flow.
2. Duplicate detection and explainable findings.
3. Shared-registry double-financing checks and atomic reservation.
4. Separate buyer confirmation.
5. Buyer-payment and receivables risk indicators.
6. A real blockchain hash anchor.
7. Clear audit history and a polished demo.

The central innovation is not claiming that software can prove every invoice genuine. It is showing **what evidence was checked, who supplied it, which independent checks passed, whether a participating lender has already registered or financed the claim, what remains uncertain, and how the decision can be audited later**.

---

## References

1. **Synesis 26 — Fintech Problem Statements** (user-provided brief). Primary source for the required features and goal.
2. Reserve Bank of India, **TReDS FAQs**: https://www.rbi.org.in/scripts/FAQView.aspx/FAQView.aspx/FAQView.aspx?Id=132
3. Bank for International Settlements, **FinTech journey / duplicate-financing context**: https://www.bis.org/speeches/20171115-singapore-fintech-journey-20
4. National Institute of Standards and Technology, **Secure Hash Standard**: https://www.nist.gov/publications/secure-hash-standard
5. Ethereum.org, **Deploying smart contracts**: https://ethereum.org/developers/docs/smart-contracts/deploying/
6. GST e-Invoice portal: https://einvoice3.gst.gov.in/
7. Supabase documentation, **Storage access control**: https://supabase.com/docs/guides/storage/security/access-control

**Source discipline:** the hackathon requirements above come from the supplied problem statement. The technical design and six-hour priorities are recommendations. The prototype's synthetic data, shared demo registry, and simulated buyer portal are demonstrations, not evidence of production performance.
