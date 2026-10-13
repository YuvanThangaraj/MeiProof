# MeiProof database schema

The ordered local schema is in:

1. `supabase/migrations/202610130001_initial_meiproof_schema.sql` — core identity, claims, workflow records, private evidence storage, initial RLS.
2. `supabase/migrations/202610130002_complete_meiproof_data_model.sql` — request history, evidence and verification provenance, risk separation, registry lifecycle, notifications/preferences, and tighter write policies.

These files describe the intended database. Neither migration has been applied or verified against the hosted project in this workspace. See [DATABASE_COVERAGE.md](DATABASE_COVERAGE.md) for the route-to-data mapping and [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for the safe apply steps.

## Table catalog

Every application table is in `public`, has RLS enabled, and is listed in the grant/policy setup of the migrations. Except for the named insert/update paths below, ordinary browser clients receive read-only grants. Synthetic rows are tagged with `record_source = 'synthetic'` or fixture keys and do not create Auth users or memberships.

| Table | Purpose, key fields and relationships | Main constraints and lookup indexes | Client RLS / writes |
|---|---|---|---|
| `profiles` | Auth user id, display name, timestamps | PK/FK to `auth.users`; updated-at trigger | Read/update own display name |
| `organizations` | Seller, buyer, lender identity and business details | kind, source checks; fixture key | Read only as a member; trusted admin writes |
| `organization_memberships` | Auth user ↔ organization role | unique `(organization_id,user_id)`; role must match organization kind; user/role index | Read own rows; trusted admin writes only |
| `organization_access_requests` | Signup organization and requested role, review state and reviewer | unique user; status/role checks; Auth user FK set null on deletion | Read own request; trusted admin writes only |
| `organization_access_request_events` | Append-only submitted/reviewed/granted history | request/user/org/actor FKs; status/event/source checks; user and request time indexes | Read own events; trigger/admin writes |
| `claims` | Seller/buyer invoice identity, dates, currency, amount, PO/payment terms, state and risk snapshot | organization FKs; amount/date/status/risk/source checks; invoice identity and buyer composite indexes | Read only through participant membership; trusted validated submission required for writes |
| `claim_lender_assignments` | Trusted lender access to a claim | claim/org/user FKs; unique claim+lender; lender lookup index | Read by assigned lender; trusted admin writes |
| `claim_documents` | Evidence metadata: type, source, version, hash, storage path and uploader | claim/Auth FKs; document/source/version/hash/path checks; unique claim+type+version and hash indexes | Participants read; seller insert only for own claim and exact private object path; no update/delete |
| `claim_line_items` | Invoice/PO/delivery line values and amounts | claim FK; positive quantity, nonnegative amount; unique claim+line; claim order index | Participants read; trusted workflow writes |
| `document_extractions` | Extraction run engine/version/status/timing | claim/document/Auth FKs; composite id+claim key; status/time checks; claim/document time indexes | Participants read; service workflow writes |
| `document_extracted_fields` | Extracted/corrected/verified field value and source location | extraction+claim composite FK; field/provenance/page/confidence checks; unique extraction+field; claim+field index | Participants read; service workflow writes |
| `verification_runs` | Versioned comparison/verification run and summary | claim/Auth FKs; composite id+claim key; status/timing checks; claim time index | Participants read; service workflow writes |
| `verification_findings` | Per-rule pass/warning/fail/missing result and evidence | composite run+claim FK; result/severity checks; claim time and run/rule indexes | Participants read; service workflow writes |
| `duplicate_candidates` | Exact/hash/identity/similarity candidate with disposition | source and candidate claim FKs; non-self match, similarity/basis checks; unique claim pair+basis; both-claim indexes | Read only if user can access both claims; service workflow writes |
| `claim_status_history` | Claim state transition, actor, reason and source | claim/Auth FKs; constrained states; claim time index | Participants read; status trigger/service writes; no client mutation |
| `claim_buyer_responses` | Buyer confirmation/dispute/correction history | claim/org/Auth FKs; response check; claim time index | Participants read; addressed buyer member may insert own response; no update/delete |
| `claim_lender_reviews` | Assigned-lender decisions and notes | claim/org/Auth FKs; decision check; claim time index | Participants read; assigned lender may insert own review; no update/delete |
| `buyer_payment_records` | Buyer receivables/payment history inputs, source and due/paid amounts | buyer/optional claim FKs; currency/amount/date/outstanding/source checks; org+due and claim indexes | Buyer reads own organization; lender reads only rows tied to its assigned claims; trusted import writes |
| `risk_assessments` | Transaction-integrity risk level, methodology, explanation and source coverage | claim FK; level/source/JSON checks; claim+created index | Claim participants read; service writes |
| `risk_assessment_factors` | Explainable transaction-integrity factor details | assessment FK; factor/severity checks; unique assessment+factor; assessment index | Claim participants read; service writes |
| `buyer_payment_risk_assessments` | Separate buyer payment-history risk assessment | claim+buyer composite FK; level/method/JSON checks; claim+created index | Buyer and its assigned lenders only; service writes |
| `buyer_payment_risk_factors` | Explainable buyer payment-risk factors | assessment FK; factor/severity/source checks; unique assessment+factor; assessment index | Buyer and authorized lender via assessment; service writes |
| `audit_events` | Append-only claim workflow event payload and actor/source | claim/Auth FKs; event/source checks; claim+created index | Claim participants read; trusted triggers/services write; no client mutation |
| `registry_reservations` | Participating registry claim/lender key, status, expiry and financed amount | claim/org/Auth FKs; lifecycle/amount/expiry/source checks; partial unique active normalized-key index; lender+created index | No direct client insert/update/delete. `reserve_claim` and `transition_claim_reservation` enforce membership, assignment, atomic uniqueness and generic conflicts |
| `registry_checks` | Search/reservation result scoped to initiating lender | claim/org/Auth FKs; outcome/count/source checks; claim and lender time indexes | Initiating lender reads own check; authorized function writes |
| `registry_conflicts` | Opaque fingerprint and generic conflict details | check FK; SHA-256 fingerprint format; status check; check index | Only lender authorized for parent check can read; function writes |
| `registry_reservation_events` | Append-only reserve/finance/release/expiry/repaid history | reservation/Auth FKs; event/status/amount checks; reservation time index | Assigned lender reads events; function/admin writes |
| `chain_anchors` | Off-chain manifest hash plus optional chain/transaction reference and state | claim/event/document FKs; hash/address/tx/block/status checks; unique tx hash; claim time index | Claim participants read; trusted anchor worker writes |
| `notifications` | User- or organization-targeted workflow message and route key | recipient/org/claim FKs; recipient requirement, type and route checks; user/org time indexes | Recipient or organization members read; trusted workflow writes |
| `notification_reads` | Per-user read timestamp for a notification | composite notification+user PK; notification/Auth FKs; user/read index | Own read state only; insert own row/update read timestamp |
| `user_preferences` | Locale, timezone, notification settings and JSON preferences | Auth user PK/FK; locale/timezone/object checks; updated-at trigger | Own row only; user may insert/update preference columns |

## Storage and security

`claim-evidence` is created as private, with a 20 MiB ceiling and PDF/JPEG/PNG/WebP allowlist. Object names are `<claim-uuid>/<uploader-uuid>/<object-uuid>`. Seller upload policies check the authenticated user and seller membership for the claim. Reads require claim participant access and a matching `claim_documents` row. Metadata insertion requires an existing private object. No permanent public URLs are used.

All `SECURITY DEFINER` application functions set an empty `search_path` and qualify referenced objects. Auth signup creates only a profile and untrusted access request. No browser policy lets a user create memberships, assign lenders, approve a request, rewrite audit history, or set a registry reservation directly. The registry uniqueness guarantee covers only this database's participating records; it is not global.

## Workflow constraints and scope

Registry identity is normalized from seller organization, buyer organization and trimmed invoice number. A partial unique index permits at most one active (`reserved`, `partially_financed`, `financed`) reservation. `reserve_claim` inserts under a transaction and returns only a generic conflict; lifecycle transitions are validated and recorded in reservation events and audit events.

Synthetic buyer replies, lender decisions, payment history, extractions, verification findings, risk values, registry events, notifications and chain references remain illustrative fixtures. A synthetic `anchored` row does not mean a chain request or transaction occurred. The migrations provide a storage model and database guardrails, not the absent browser/API workflows, OCR, credit scoring, blockchain integration or hosted setup.
