# MeiProof backend

This directory now contains a Supabase-backed FastAPI service for the MeiProof evidence workflow. It does not determine whether an invoice is genuine or true. It returns evidence findings, duplicate candidates, buyer responses, registry outcomes, and illustrative risk indicators with explicit disclaimers.

## Configuration

Copy `.env.example` to `.env` and provide values only on the backend host:

- `SUPABASE_URL`: project base URL, without `/rest/v1` or `/auth/v1`.
- `SUPABASE_PUBLISHABLE_KEY`: used with the caller's Auth bearer token for RLS-protected operations and RPCs. `SUPABASE_ANON_KEY` remains accepted for legacy projects.
- `SUPABASE_SECRET_KEY`: backend-only key used for trusted verification writes and claim creation. It bypasses RLS and must never be exposed to Vite or the browser. `SUPABASE_SERVICE_ROLE_KEY` remains accepted for legacy projects.
- `STORAGE_BUCKET`: private `claim-evidence` bucket by default.
- `DEMO_MODE`: `true` only for a clearly labelled synthetic environment.
- `OCR_ENABLED`: enables the optional Tesseract fallback for scanned PDFs and images.
- `TESSERACT_CMD`: optional absolute path to the Tesseract executable on the backend host.
- `CORS_ORIGINS`: comma-separated browser origins allowed to call the API; local Vite origins on port 8443 are configured by default.

Apply the ordered migrations and seed through the Supabase CLI or SQL editor before using the API. The service does not create memberships or grant roles.

### Add local credentials

The Vite frontend and FastAPI backend read separate files. The frontend's `VITE_*` variables do not configure this API. From the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
notepad backend/.env
```

Set `SUPABASE_URL` to the Project URL, `SUPABASE_PUBLISHABLE_KEY` to the publishable key, and `SUPABASE_SECRET_KEY` to a backend secret key from the Supabase Dashboard API Keys page. The secret key bypasses RLS and must stay in this ignored `backend/.env`; never use a `VITE_` variable for it. This backend sends modern secret keys in the `apikey` header only. Legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` JWT keys also work. Restart Uvicorn after editing the file.

## Run

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API expects `Authorization: Bearer <Supabase access token>`. It verifies the token with Supabase Auth, loads organization memberships, and applies role and organization checks on every protected operation. Cross-organization claim access returns 404.

The Vite app uses `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`). Authenticated seller, buyer, and lender screens send the active Supabase session token to this API. Demo login does not call protected routes and continues to use synthetic local data.

## Implemented API surface

| Route | Purpose |
|---|---|
| `GET /health` | Non-sensitive service status |
| `GET /api/me` | Current Auth user and memberships |
| `GET /api/organizations?kind=buyer` | Buyer organization choices for an approved seller |
| `GET /api/claims` | RLS-scoped claim list |
| `POST /api/claims` | Seller claim creation through the backend |
| `GET /api/claims/{id}` | Claim and participant-visible evidence metadata |
| `POST /api/claims/{id}/documents` | Private Storage upload plus hashed metadata |
| `GET /api/claims/{id}/documents/{document_id}/url` | Five-minute private signed URL |
| `POST /api/claims/{id}/buyer-response` | Buyer confirmation, dispute, or correction request |
| `POST /api/claims/{id}/extract` | Private document extraction with field provenance and OCR status |
| `POST /api/claims/{id}/verify` | OCR-backed evidence findings, Decimal-safe cross-document arithmetic, and risk separation |
| `GET /api/claims/{id}/duplicates` | Privacy-safe participating-registry duplicate candidates |
| `POST /api/claims/{id}/registry/reserve` | Atomic `reserve_claim` RPC |
| `POST /api/registry/{reservation_id}/transition` | Validated reservation lifecycle RPC |
| `POST /api/claims/{id}/lender-review` | Assigned-lender review record |

## Truth boundary

The extraction service first uses PyMuPDF text extraction. If a PDF has no text layer, or an uploaded image needs processing, it can use Tesseract OCR when enabled and installed. Every extracted field stores its raw value, normalized value, page number where available, confidence, and `provenance_type=extracted` in `document_extractions` and `document_extracted_fields`.

Verification uses `Decimal` arithmetic and emits separate findings for claim amount versus invoice total, invoice versus purchase-order total, invoice versus delivered value, and structured line-item extensions. Missing or uncertain values are not treated as passes. These comparisons are consistency checks over submitted evidence, not proof that the underlying transaction occurred.

The OCR and arithmetic module is not credit underwriting, GST/e-invoice verification, handwriting authentication, or a guarantee of delivery/payment. It does not claim blockchain anchoring; `/health` reports anchoring as disabled/not configured.

The database migrations and RLS remain authoritative. The backend uses service-role writes only after independently verifying the Supabase bearer token and membership. Storage remains private, paths are claim/user/object scoped, and original filenames are not included in manifests or registry responses.

## Validation status

Validated on 2026-10-13 with Python 3.12.3:

```powershell
py -m compileall app
py -m pytest -q
```

Both checks passed. Startup initially exposed a module/package name collision between `app/schemas.py` and `app/schemas/`; schema models now live in `app/schemas/models.py` and are exported through the package. The API is running locally at `http://127.0.0.1:8000`; `/health` and `/openapi.json` return 200, and an unauthenticated `/api/me` returns the expected 401.

No `backend/.env` is configured in this workspace. The local server can serve health and OpenAPI, but Supabase-backed endpoints have not been integration-tested here and need the backend-only settings above plus an approved Supabase account. Do not copy a service-role key into the frontend `.env.local`.

Connectivity probe: the configured Supabase Auth settings endpoint returned HTTP 200. An anonymous read of `organization_memberships` returned HTTP 401 / Postgres code `42501` (`permission denied for table organization_memberships`), consistent with anon access being denied. No authenticated membership query was attempted, and the backend process itself has no Supabase credentials loaded.

The repository frontend checks remain separate: `pnpm.cmd exec tsc --noEmit` and `pnpm.cmd build`.
