## Daniel Supabase pitch account (2026-10-13)

- Added a confirmed Supabase Auth identity named Daniel at `daniel.demo@meiproof.test`, with an isolated synthetic seller organization and an approved seller membership recorded through the existing access-request audit tables. The account has no buyer or lender role.
- Added `POST /api/demo-login`. It exchanges server-held demo credentials for a Supabase session only when `MEIPROOF_ENV=development`, the feature is enabled, the configured Auth user ID matches the pinned demo identity, and the request comes from loopback. The password remains in ignored `backend/.env`; the browser receives only the session tokens needed by Supabase Auth.
- Added a labelled “Continue as Daniel” option to the Supabase login page. It uses the normal Auth session and membership lookup; it does not set a frontend-only role. The authenticated workspace identifies the Daniel demo account.
- Added `DEMO_LOGIN_*` and `VITE_DEMO_ACCOUNT_ENABLED` names to the example environment files. The local ignored environment enables the button and uses API port 8001; the sample files do not contain credentials.
- Verified `POST /api/demo-login` → HTTP 200, then authenticated `GET /api/me` → HTTP 200 with Daniel’s configured user ID and seller membership. A frontend-origin CORS preflight from `http://127.0.0.1:8444` → HTTP 200.
- Local services for this session: Vite at `http://127.0.0.1:8444` and the updated FastAPI process at `http://127.0.0.1:8001`. Earlier processes still occupy default ports 8443 and 8000.
- `pnpm.cmd exec tsc --noEmit` — passed. `pnpm.cmd build` — passed with the large-chunk warning (527.40 kB JavaScript). `py -m compileall app` — passed. `pnpm.cmd exec oxfmt --check src/App.tsx src/lib/backend.ts src/lib/supabase.ts` — failed because those files do not match the repository formatter; the monolithic app was not wholesale reformatted.
- The authenticated API path was exercised directly. The login-page button is present in the production bundle, but no browser click-through was performed.

## Supabase-backed FastAPI integration (2026-10-13)
## Supabase-backed FastAPI integration (2026-10-13)

- Replaced the placeholder backend with a modular FastAPI service under `backend/app/`.
- Added Supabase Auth bearer verification, membership loading, organization-scoped authorization, and cross-organization 404 behavior.
- Added claim listing/creation, private evidence upload with SHA-256 metadata, five-minute Storage signed URLs, buyer responses, baseline verification findings, duplicate-candidate reporting, atomic registry reservation through `reserve_claim`, registry transitions through `transition_claim_reservation`, and assigned-lender reviews.
- The service uses the existing Supabase migrations and RLS/RPC contracts. The Supabase service-role key is read only from backend environment configuration and is never used by the frontend.
- Verification currently implements an evidence-presence baseline and separate transaction-integrity/payment-risk response shape. It does not yet provide full OCR, cross-document arithmetic, blockchain anchoring, or production credit underwriting.
- At the initial integration checkpoint, backend compile/test execution was pending. It has since been run; see “Local backend startup check” below.
- The attached integration prompt was not available as a readable file on the selected device; repository specification, migrations, schema coverage, and implementation-status documents were used as the integration contract.


## OCR and cross-document arithmetic module (2026-10-13)

The backend now includes `app/extraction.py` and `app/verification.py`. Text-based PDFs use PyMuPDF; scanned PDFs and images use an optional Tesseract OCR fallback. Extracted fields are persisted with raw/normalized values, confidence, provenance, and extraction status. Verification now compares claim amount, invoice total, purchase-order total, delivered value, and structured line-item extensions using Python `Decimal`, with missing and uncertain evidence represented explicitly rather than treated as passes. The new `POST /api/claims/{id}/extract` endpoint exposes only extraction status and counts; document bytes remain private.

OCR requires the `pytesseract` and `Pillow` dependencies plus a host Tesseract executable. If unavailable, the service records `OCR_UNAVAILABLE` rather than claiming extraction succeeded. At the initial OCR checkpoint, Python runtime checks were pending; they have since been run.

## Local backend startup check (2026-10-13)

- First Uvicorn startup failed because both `app/schemas.py` and `app/schemas/` existed, so Python imported the empty package and could not find the request/response models. Moved the models into `app/schemas/models.py` and exported the API models from `app/schemas/__init__.py`.
- `py -m compileall app` — passed on Python 3.12.3.
- `py -m pytest -q` — passed: 3 tests.
- `py -m uvicorn app.main:app --host 127.0.0.1 --port 8000` — running at `http://127.0.0.1:8000`.
- Verified `GET /health` → 200 (`status=ok`, `service=meiproof-backend`, development mode); `GET /openapi.json` → 200; unauthenticated `GET /api/me` → expected 401 `Bearer token required`.
- At this earlier startup checkpoint, no `backend/.env` was configured. The current configured state and authenticated demo-account check are recorded above. Do not copy a service-role key into the frontend `.env.local`.
- Follow-up connectivity probe: the configured project's Auth settings endpoint returned HTTP 200. An anonymous read of `organization_memberships` returned HTTP 401 / Postgres `42501` (`permission denied for table organization_memberships`); this is consistent with the intentional anon-deny policy and does not test an authenticated user's membership read. The backend process has no Supabase URL, anon key, or service-role key in its environment and therefore is not connected to Supabase. No user token was available for an end-to-end protected-route check.

## Supabase backend key configuration (2026-10-13)

- Backend settings accept the current `SUPABASE_PUBLISHABLE_KEY` and server-only `SUPABASE_SECRET_KEY` names, while retaining compatibility with the legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names.
- The gateway sends modern secret keys only as the `apikey` header; legacy service-role JWT keys retain the legacy authorization header behavior. User access tokens remain the bearer token for authenticated requests.
- Replaced values in `backend/.env.example` with placeholders and documented copying it to ignored `backend/.env`. At that checkpoint no real backend environment file was configured; the current live configuration and checks are recorded above.
- `py -m compileall app` — passed. `py -m pytest -q` — passed: 3 tests. One-off header checks for modern and legacy key formats passed.
- Authenticated frontend workflows call the FastAPI routes. The role-selector demo remains local and synthetic; the separate Daniel pitch login is Supabase-backed and documented above.

## Frontend to FastAPI connection (2026-10-13)

- Added `src/lib/backend.ts` with typed requests, bearer-token forwarding from the active Supabase session, API errors, and a local default API URL (`http://127.0.0.1:8000`). The browser never receives the backend secret key.
- Added FastAPI CORS for the two local Vite origins and `GET /api/organizations?kind=buyer`, restricted to authenticated seller members, to populate the claim form's recipient selector.
- Authenticated pages now load claims and API membership data. The claim wizard creates a claim, uploads selected files, requests extraction and verification, then opens the created claim. Claim detail can request short-lived private file URLs. Evidence, buyer response, lender review, registry reservation, and reservation lifecycle actions call their API routes.
- The original role-selector demo still uses synthetic in-browser data. The separate Daniel pitch account uses Supabase Auth and approved membership.
- Replaced credential-looking values in `backend/.env.example` with placeholders, corrected the sample URL, and added `CORS_ORIGINS`. Treat any real secret previously placed in that example as exposed and rotate it.
- `pnpm.cmd exec tsc --noEmit` — passed.
- `pnpm.cmd build` — passed. Vite reported a 526.23 kB JavaScript chunk warning.
- `py -m compileall app` — passed.
- `pnpm.cmd exec oxfmt --check src/App.tsx src/lib/backend.ts` — failed with format issues. The repository documents a formatter issue for the monolithic app; no full-file reformat was applied.
- Local HTTP checks: Vite home → 200; FastAPI `/health` → 200; preflight from `http://127.0.0.1:8443` → 200 with the expected CORS allow-origin/headers/methods; unauthenticated `/api/me` → expected 401 with CORS headers.
- At this earlier checkpoint, browser UI verification was declined and no authenticated API request was tested. The current Daniel-authenticated API check is recorded above.
