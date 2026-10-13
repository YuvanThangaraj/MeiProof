# Supabase setup

## Browser configuration

In the Supabase Dashboard, open the intended project’s **Connect** panel and copy its Project URL and **publishable** key. In this Vite app, create `.env.local` from `.env.example` and set:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_...>
VITE_DEMO_MODE=true
```

The published key is intended for browser use; table and storage RLS are the data boundary. Never put a PostgreSQL password, `service_role` key, or secret API key in a `VITE_*` variable or source file. `.env.local` is ignored by Git. A partial URL/key configuration stops the app at sign-in with a setup error instead of silently falling back to the demo selector.

The connection string shared in chat is a database credential and is not used by the browser client. Rotate that database password before using direct database connections. It is absent from project files and this setup.

## FastAPI backend configuration

The backend does not read the frontend `.env.local`. From the repository root, copy `backend/.env.example` to the ignored `backend/.env` and fill `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` using the project's Dashboard API Keys page. The secret key bypasses RLS, belongs only in the backend `.env`, and must never use a `VITE_` prefix. The backend sends modern `sb_secret_` keys in the `apikey` header only; legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` JWT values remain supported. Restart Uvicorn after editing. Authenticated frontend workflows call FastAPI with the active Supabase bearer token.

The local Daniel pitch account uses `DEMO_LOGIN_ENABLED`, `DEMO_LOGIN_EMAIL`, `DEMO_LOGIN_PASSWORD`, and `DEMO_LOGIN_USER_ID` in the ignored backend `.env`. Enable the login-page button separately with `VITE_DEMO_ACCOUNT_ENABLED=true` in ignored `.env.local`. The password is never placed in frontend variables or source. FastAPI enables this account exchange only in development and for loopback requests; the account has an approved seller membership in a dedicated demo organization.

The previous `backend/.env.example` contained credential-looking values and a malformed URL. It has been replaced with placeholders. Treat any real key that was placed there as exposed and rotate it in the Supabase Dashboard before use. Do not send replacement keys in chat.

## Authentication and workspace access

1. Set the project’s Auth **Site URL** to `http://localhost:8443` for local development.
2. Add redirect URLs `http://localhost:8443/reset` and `http://127.0.0.1:8443/reset` (and your actual production origins) in the Auth URL configuration.
3. Configure email confirmation and SMTP in the project if account verification or password recovery mail is required. The frontend reports Supabase’s response; it cannot verify that an email reached a mailbox.
4. Apply the migration below. Signup creates a profile and an untrusted access request only. A trusted administrator must create the organization and approve a matching membership. A signup request for `lender` does not create lender privilege.

When Supabase is configured, password sign-in, sign-up, session restoration, sign-out, password-reset request, and password update use Supabase Auth. Pages under the existing authenticated route set require a session and one unambiguous approved membership role. Authenticated claim listing/creation, evidence upload, extraction/verification, buyer responses, lender reviews, and registry reservations call FastAPI with the user's access token. The original role-selector demo remains synthetic; the separate Daniel pitch account creates a real Supabase session and still passes the usual membership check. Audit event retrieval, persistent profile/preferences, and blockchain anchoring are not connected to the browser.

## Migrations and seed data

This project includes `supabase/config.toml`, two ordered migrations, an RLS/pgTAP test file, and repeatable synthetic `supabase/seed.sql`. The migrations create the complete documented data model, private bucket policies, constraints and indexes. They contain no database reset, drop or truncate operation. See `docs/DATABASE_COVERAGE.md` for the route and workflow audit.

For a local Supabase stack (requires Docker Desktop on Windows):

```powershell
Copy-Item .env.example .env.local
# Edit .env.local and paste only the Project URL and publishable key from Supabase Connect.
pnpm install --frozen-lockfile
pnpm exec supabase --version
pnpm exec supabase start
pnpm exec supabase migration up --local
pnpm exec supabase test db
```

The configured local seed runs as part of first local database initialization. Do not use a reset command against any shared or remote project. Stop local services with `pnpm exec supabase stop`.

For the scoped hosted project, first inspect its current database state in the Supabase Dashboard. Verify the project name/ref is `rqlcwjuyaiyhepcrjgup` and inspect the current tables, policies, storage bucket and migration history. The ref in `.env.local` matches this project; environment values were not printed. Remote schema and seed changes have not been applied in this workspace. The prior pasted database password should be rotated before direct database use.

If using the CLI after installation and login:

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref rqlcwjuyaiyhepcrjgup
pnpm exec supabase migration list --linked
pnpm exec supabase db push --dry-run
```

If the CLI requests a database password while linking/applying, enter the newly rotated password at its secure prompt. Do not put the password in `.env.local`, a `VITE_*` variable, or a command line.

Review the migration list and dry-run against the Dashboard state. Resolve any existing migration history or table-name conflicts before applying. Then run `pnpm exec supabase db push` only after confirming this is the intended development project. This does not execute `seed.sql`: paste `supabase/seed.sql` into that project's SQL Editor and run it only after migrations succeed. Do not seed production.

Verify fixture counts in SQL Editor:

```sql
select 'organizations' as table_name, count(*) from public.organizations where fixture_key like 'mei-demo-%'
union all select 'claims', count(*) from public.claims where fixture_key like 'mei-demo-%'
union all select 'claim_documents', count(*) from public.claim_documents where fixture_key like 'mei-demo-%'
union all select 'notifications', count(*) from public.notifications where fixture_key like 'mei-demo-%';

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in (
    'profiles','organizations','organization_memberships','organization_access_requests',
    'organization_access_request_events','claims','claim_lender_assignments','claim_documents',
    'claim_line_items','document_extractions','document_extracted_fields','verification_runs',
    'verification_findings','duplicate_candidates','claim_status_history','claim_buyer_responses',
    'claim_lender_reviews','buyer_payment_records','risk_assessments','risk_assessment_factors',
    'buyer_payment_risk_assessments','buyer_payment_risk_factors','audit_events',
    'registry_reservations','registry_checks','registry_conflicts','registry_reservation_events',
    'chain_anchors','notifications','notification_reads','user_preferences'
  ) order by c.relname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'claim-evidence';
```

Expected stable fixture counts are 4 organizations, 6 claims, 10 document metadata rows and 2 notifications. These are expectations from the seed file, not remote results. It inserts no Auth users, memberships, Storage objects or file bytes. Verify that all 31 listed tables return `rls_enabled = true`; also inspect policies in Dashboard and run the RLS tests locally. Do not use service credentials in browser configuration.

For the existing account, inspect the exact Auth user, `organization_access_requests` row and organization match in Dashboard before granting access. `supabase/admin/approve_existing_seller.sql` is an admin-only transaction template that requires replacing the email placeholder with that exact confirmed Auth email; it grants seller only and errors on non-seller or ambiguous organization matches. Review the transaction before execution. It does not automatically grant a lender role.

## Storage and data security

The migration creates `claim-evidence` as a private bucket with a 20 MiB size ceiling and PDF/JPEG/PNG/WebP content type allowlist. Storage object names follow `<claim-uuid>/<uploader-uuid>/<object-uuid>`. Policies permit seller members to upload only to their claim path; reads require claim participation and matching `claim_documents` metadata. A database trigger rejects metadata pointing to a missing Storage object. No browser upload flow has been enabled yet. Client-side file checks would not replace server-side scanning or validation; this setup does not provide malware scanning.

Organization membership, lender assignment, and request approval have no client write policies. They require trusted administration. Buyer responses and lender reviews are append-only to ordinary clients. Reservation creation and lifecycle changes use restricted security-definer functions; audit events are read-only to browser clients until trusted workflow capture is implemented. A partial unique index prevents two active rows for one normalized seller/buyer/invoice identity in this database. This is not a global registry. Claim inserts are withheld until recipient-organization validation is implemented. The project’s privileged Dashboard administration remains a trust boundary.

## Rollback and troubleshooting

The migration is additive. No destructive rollback is provided because dropping tables or deleting member data is unsafe. To disable browser integration, remove the two Supabase variables from `.env.local` and keep `VITE_DEMO_MODE=true`; this does not undo remote schema changes. If Auth redirects fail, check the exact local/production redirect URL allowlist and email provider configuration. If claim queries return no rows, verify an administrator-approved organization membership and claim assignment; an Auth account alone grants no workspace access.
