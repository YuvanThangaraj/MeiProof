create extension if not exists pgtap with schema extensions;

begin;
select no_plan();

select has_table('public', 'profiles', 'Auth profiles are in the application schema');
select has_table('public', 'organizations', 'Organizations are modeled');
select has_table('public', 'organization_memberships', 'Membership roles are modeled');
select has_table('public', 'organization_access_requests', 'Signup requests are modeled');
select has_table('public', 'claim_line_items', 'Invoice line items are modeled');
select has_table('public', 'claim_documents', 'Evidence metadata is modeled');
select has_table('public', 'document_extractions', 'Extraction runs are modeled');
select has_table('public', 'document_extracted_fields', 'Extracted values retain provenance');
select has_table('public', 'verification_runs', 'Verification runs are modeled');
select has_table('public', 'verification_findings', 'Verification findings are modeled');
select has_table('public', 'duplicate_candidates', 'Duplicate candidates are modeled');
select has_table('public', 'claim_buyer_responses', 'Buyer response history is modeled');
select has_table('public', 'claim_lender_reviews', 'Lender review history is modeled');
select has_table('public', 'buyer_payment_records', 'Payment-risk inputs are modeled');
select has_table('public', 'buyer_payment_risk_assessments', 'Buyer payment risk is stored separately from transaction integrity');
select has_table('public', 'risk_assessments', 'Separate risk assessments are modeled');
select has_table('public', 'registry_reservations', 'Registry reservations are modeled');
select has_table('public', 'chain_anchors', 'Chain anchor references are modeled');
select has_table('public', 'audit_events', 'Audit events are modeled');
select has_table('public', 'notifications', 'Notifications are modeled');
select has_table('public', 'notification_reads', 'Notification read status is modeled per user');
select has_table('public', 'user_preferences', 'Account preferences are modeled');

select ok((select bool_and(c.relrowsecurity)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in (
      'profiles', 'organizations', 'organization_memberships', 'organization_access_requests',
      'organization_access_request_events', 'claims', 'claim_lender_assignments', 'claim_documents',
      'claim_line_items', 'document_extractions', 'document_extracted_fields', 'verification_runs',
      'verification_findings', 'duplicate_candidates', 'claim_status_history', 'claim_buyer_responses',
      'claim_lender_reviews', 'buyer_payment_records', 'risk_assessments', 'risk_assessment_factors',
      'buyer_payment_risk_assessments', 'buyer_payment_risk_factors',
      'audit_events', 'registry_reservations', 'registry_checks', 'registry_conflicts',
      'registry_reservation_events', 'chain_anchors', 'notifications', 'notification_reads', 'user_preferences'
    )), 'RLS is enabled on every MeiProof public table');

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-seller-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-seller-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rls-buyer@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rls-lender-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'rls-lender-b@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.organizations (fixture_key, name, kind, record_source) values
  ('rls-test-seller-a', 'RLS Test Seller A', 'seller', 'synthetic'),
  ('rls-test-seller-b', 'RLS Test Seller B', 'seller', 'synthetic'),
  ('rls-test-buyer', 'RLS Test Buyer', 'buyer', 'synthetic'),
  ('rls-test-lender-a', 'RLS Test Lender A', 'lender', 'synthetic'),
  ('rls-test-lender-b', 'RLS Test Lender B', 'lender', 'synthetic');

insert into public.organization_memberships (organization_id, user_id, role)
select o.id, f.user_id::uuid, f.role
from (values
  ('rls-test-seller-a', '10000000-0000-0000-0000-000000000001', 'seller'),
  ('rls-test-seller-b', '10000000-0000-0000-0000-000000000002', 'seller'),
  ('rls-test-buyer', '10000000-0000-0000-0000-000000000003', 'buyer'),
  ('rls-test-lender-a', '10000000-0000-0000-0000-000000000004', 'lender'),
  ('rls-test-lender-b', '10000000-0000-0000-0000-000000000005', 'lender')
) as f(org_key, user_id, role)
join public.organizations o on o.fixture_key = f.org_key;

insert into public.claims
  (fixture_key, seller_organization_id, buyer_organization_id, invoice_number, currency, amount, status, record_source)
select 'rls-test-claim-own', s.id, b.id, 'RLS-INV-1', 'INR', 100.00, 'ready_for_review', 'synthetic'
from public.organizations s, public.organizations b
where s.fixture_key = 'rls-test-seller-a' and b.fixture_key = 'rls-test-buyer';
insert into public.claims
  (fixture_key, seller_organization_id, buyer_organization_id, invoice_number, currency, amount, status, record_source)
select 'rls-test-claim-other', s.id, b.id, 'RLS-INV-2', 'INR', 200.00, 'submitted', 'synthetic'
from public.organizations s, public.organizations b
where s.fixture_key = 'rls-test-seller-b' and b.fixture_key = 'rls-test-buyer';

insert into public.claim_lender_assignments (claim_id, lender_organization_id, record_source)
select c.id, l.id, 'synthetic'
from public.claims c cross join public.organizations l
where c.fixture_key = 'rls-test-claim-own' and l.fixture_key in ('rls-test-lender-a', 'rls-test-lender-b');
insert into public.audit_events (claim_id, event_type, event_payload, record_source)
select id, 'claim_created', '{"test":true}', 'synthetic'
from public.claims where fixture_key = 'rls-test-claim-own';

set local role anon;
select throws_ok('select * from public.claims', '42501', 'anon cannot select protected business claims');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*)::integer from public.claims where fixture_key = 'rls-test-claim-own'), 1, 'seller can read their own claim');
select is((select count(*)::integer from public.claims where fixture_key = 'rls-test-claim-other'), 0, 'seller cannot read another seller claim');
select throws_ok(
  $$insert into public.organization_memberships (organization_id, user_id, role)
    select id, '10000000-0000-0000-0000-000000000001', 'lender' from public.organizations where fixture_key = 'rls-test-lender-a'$$,
  '42501', 'seller cannot grant themselves a lender membership'
);
select throws_ok(
  $$insert into public.claim_buyer_responses (claim_id, buyer_organization_id, actor_id, response)
    select c.id, c.buyer_organization_id, '10000000-0000-0000-0000-000000000001', 'confirmed'
    from public.claims c where c.fixture_key = 'rls-test-claim-own'$$,
  '42501', 'seller cannot submit a buyer response'
);
select throws_ok(
  $$update public.audit_events set event_payload = '{"changed":true}' where event_type = 'claim_created'$$,
  '42501', 'ordinary users cannot rewrite audit history'
);
select is((select count(*)::integer from public.registry_reservations), 0, 'a lender cannot read other lender reservation rows');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select lives_ok(
  $$insert into public.claim_buyer_responses (claim_id, buyer_organization_id, actor_id, response, comment)
    select c.id, c.buyer_organization_id, '10000000-0000-0000-0000-000000000003', 'confirmed', 'test'
    from public.claims c where c.fixture_key = 'rls-test-claim-own'$$,
  'the addressed buyer can record a response'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select outcome from public.reserve_claim(
  (select id from public.claims where fixture_key = 'rls-test-claim-own'),
  (select id from public.organizations where fixture_key = 'rls-test-lender-a'), 24
)), 'reserved', 'authorized lender can atomically reserve an assigned claim');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select outcome from public.reserve_claim(
  (select id from public.claims where fixture_key = 'rls-test-claim-own'),
  (select id from public.organizations where fixture_key = 'rls-test-lender-b'), 24
)), 'conflict', 'a competing lender receives a generic conflict instead of a second reservation');
select is((select count(*)::integer from public.registry_reservations), 0, 'competing lender cannot read the first lender reservation');
reset role;

select ok((select public = false from storage.buckets where id = 'claim-evidence'), 'evidence bucket remains private');
select is(public.claim_id_from_evidence_path('not-a-uuid/user/object'), null::uuid, 'malformed storage paths fail closed');

select * from finish();
rollback;
