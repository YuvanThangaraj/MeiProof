-- Complete the MeiProof persistence model and tighten the initial access rules.
-- Synthetic and service-generated records are distinguishable from user writes.
begin;

-- Remove a redundant duplicate role check from the first migration.
alter table public.organization_memberships drop constraint if exists organization_memberships_check;

alter table public.organizations
  add column if not exists country text not null default '',
  add column if not exists business_identifier text not null default '',
  add column if not exists website text not null default '',
  add column if not exists record_source text not null default 'user';
alter table public.organizations
  add constraint organizations_record_source_check
  check (record_source in ('user', 'system', 'synthetic'));

alter table public.claims
  add column if not exists purchase_order_reference text not null default '',
  add column if not exists payment_terms_days integer,
  add column if not exists integrity_risk_level text,
  add column if not exists payment_risk_level text,
  add column if not exists record_source text not null default 'user';
alter table public.claims
  add constraint claims_payment_terms_days_check check (payment_terms_days is null or payment_terms_days between 0 and 3650),
  add constraint claims_integrity_risk_level_check check (integrity_risk_level is null or integrity_risk_level in ('low', 'moderate', 'high', 'unknown')),
  add constraint claims_payment_risk_level_check check (payment_risk_level is null or payment_risk_level in ('low', 'moderate', 'high', 'unknown')),
  add constraint claims_record_source_check check (record_source in ('user', 'system', 'synthetic'));
create index if not exists claims_invoice_identity_idx
  on public.claims(seller_organization_id, buyer_organization_id, lower(trim(invoice_number)));
create unique index if not exists claims_id_buyer_organization_idx on public.claims(id, buyer_organization_id);

alter table public.claim_lender_assignments
  add column if not exists record_source text not null default 'user';
alter table public.claim_lender_assignments
  add constraint claim_lender_assignments_record_source_check check (record_source in ('user', 'system', 'synthetic'));

alter table public.organization_access_requests alter column user_id drop not null;
alter table public.organization_access_requests
  drop constraint if exists organization_access_requests_user_id_fkey;
alter table public.organization_access_requests
  add constraint organization_access_requests_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
alter table public.organization_access_requests
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text not null default '';

create table public.organization_access_request_events (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  access_request_id uuid references public.organization_access_requests(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('submitted', 'approved', 'rejected', 'reopened', 'membership_granted')),
  previous_status text check (previous_status is null or previous_status in ('pending', 'approved', 'rejected')),
  new_status text check (new_status is null or new_status in ('pending', 'approved', 'rejected')),
  note text not null default '' check (char_length(note) <= 4000),
  record_source text not null default 'system' check (record_source in ('admin', 'system', 'synthetic')),
  created_at timestamptz not null default now()
);
create index organization_access_request_events_user_idx
  on public.organization_access_request_events(user_id, created_at desc);
create index organization_access_request_events_request_idx
  on public.organization_access_request_events(access_request_id, created_at desc);

create or replace function public.log_access_request_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status then
    insert into public.organization_access_request_events
      (access_request_id, user_id, actor_id, event_type, previous_status, new_status, note, record_source)
    values (
      new.id, new.user_id, (select auth.uid()),
      case new.status when 'approved' then 'approved' when 'rejected' then 'rejected' else 'reopened' end,
      old.status, new.status, coalesce(new.review_note, ''),
      case when (select auth.uid()) is null then 'admin' else 'system' end
    );
  end if;
  return new;
end;
$$;
revoke all on function public.log_access_request_status_change() from public, anon, authenticated;
create trigger access_request_status_audit after update of status on public.organization_access_requests
  for each row execute function public.log_access_request_status_change();

create or replace function public.log_access_request_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_access_request_events
    (access_request_id, user_id, event_type, new_status, record_source)
  values (new.id, new.user_id, 'submitted', new.status, 'system');
  return new;
end;
$$;
revoke all on function public.log_access_request_submission() from public, anon, authenticated;
create trigger access_request_submission_audit after insert on public.organization_access_requests
  for each row execute function public.log_access_request_submission();

-- Bootstrap profiles and pending requests for Auth users that predate this migration.
insert into public.profiles (id, display_name)
select u.id, left(trim(coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', '')), 160)
from auth.users u
on conflict (id) do update
set display_name = excluded.display_name
where public.profiles.display_name = '' and excluded.display_name <> '';

insert into public.organization_access_requests
  (user_id, display_name, organization_name, requested_role, country, business_identifier, website, phone)
select u.id,
  left(trim(coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', '')), 160),
  left(trim(u.raw_user_meta_data ->> 'organization_name'), 180),
  u.raw_user_meta_data ->> 'requested_role',
  left(trim(coalesce(u.raw_user_meta_data ->> 'country', '')), 100),
  left(trim(coalesce(u.raw_user_meta_data ->> 'business_identifier', '')), 100),
  left(trim(coalesce(u.raw_user_meta_data ->> 'website', '')), 255),
  left(trim(coalesce(u.raw_user_meta_data ->> 'phone', '')), 80)
from auth.users u
where nullif(trim(u.raw_user_meta_data ->> 'organization_name'), '') is not null
  and u.raw_user_meta_data ->> 'requested_role' in ('seller', 'buyer', 'lender')
on conflict (user_id) do nothing;

create table public.claim_line_items (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  claim_id uuid not null references public.claims(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  description text not null check (char_length(description) between 1 and 1000),
  item_reference text not null default '' check (char_length(item_reference) <= 160),
  quantity numeric(18,3) not null check (quantity > 0),
  unit text not null default '' check (char_length(unit) <= 40),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  line_amount numeric(18,2) not null check (line_amount >= 0),
  record_source text not null default 'user' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  unique (claim_id, line_number)
);
create index claim_line_items_claim_idx on public.claim_line_items(claim_id, line_number);

alter table public.claim_documents
  add column if not exists document_type text not null default 'other',
  add column if not exists source_type text not null default 'seller_submitted',
  add column if not exists version_number integer not null default 1,
  add column if not exists sha256_hash text,
  add column if not exists record_source text not null default 'user';
alter table public.claim_documents
  add constraint claim_documents_document_type_check
    check (document_type in ('invoice', 'purchase_order', 'delivery_receipt', 'contract', 'other')),
  add constraint claim_documents_source_type_check
    check (source_type in ('seller_submitted', 'buyer_supplied', 'independent_source')),
  add constraint claim_documents_version_check check (version_number > 0),
  add constraint claim_documents_sha256_check
    check (sha256_hash is null or sha256_hash ~ '^[0-9a-f]{64}$'),
  add constraint claim_documents_record_source_check check (record_source in ('user', 'system', 'synthetic'));
create unique index claim_documents_version_idx
  on public.claim_documents(claim_id, document_type, version_number);
create index claim_documents_sha256_idx on public.claim_documents(sha256_hash) where sha256_hash is not null;

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  claim_id uuid not null references public.claims(id) on delete restrict,
  document_id uuid not null references public.claim_documents(id) on delete restrict,
  engine text not null check (char_length(engine) between 1 and 120),
  engine_version text not null default '' check (char_length(engine_version) <= 80),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_code text not null default '' check (char_length(error_code) <= 120),
  error_summary text not null default '' check (char_length(error_summary) <= 2000),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  unique (id, claim_id),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);
create index document_extractions_claim_created_idx on public.document_extractions(claim_id, created_at desc);
create index document_extractions_document_created_idx on public.document_extractions(document_id, created_at desc);

create table public.document_extracted_fields (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  extraction_id uuid not null,
  claim_id uuid not null,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_.-]{0,119}$'),
  raw_value jsonb not null,
  normalized_value text,
  page_number integer check (page_number is null or page_number > 0),
  source_bbox jsonb,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  provenance_type text not null check (provenance_type in ('extracted', 'human_corrected', 'independently_verified')),
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  foreign key (extraction_id, claim_id) references public.document_extractions(id, claim_id) on delete restrict,
  unique (extraction_id, field_key)
);
create index document_extracted_fields_claim_key_idx on public.document_extracted_fields(claim_id, field_key);

create table public.verification_runs (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  claim_id uuid not null references public.claims(id) on delete restrict,
  ruleset text not null check (char_length(ruleset) between 1 and 120),
  ruleset_version text not null default '' check (char_length(ruleset_version) <= 80),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  unique (id, claim_id),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);
create index verification_runs_claim_created_idx on public.verification_runs(claim_id, created_at desc);

create table public.verification_findings (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  verification_run_id uuid not null,
  claim_id uuid not null,
  rule_code text not null check (rule_code ~ '^[A-Z0-9][A-Z0-9_.-]{0,119}$'),
  result text not null check (result in ('pass', 'warning', 'fail', 'missing', 'uncertain', 'not_checked')),
  severity text not null check (severity in ('none', 'info', 'low', 'medium', 'high', 'critical')),
  field_key text,
  evidence_summary text not null default '' check (char_length(evidence_summary) <= 4000),
  source_values jsonb not null default '[]'::jsonb check (jsonb_typeof(source_values) = 'array'),
  recommended_action text not null default '' check (char_length(recommended_action) <= 1000),
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  foreign key (verification_run_id, claim_id) references public.verification_runs(id, claim_id) on delete restrict
);
create index verification_findings_claim_created_idx on public.verification_findings(claim_id, created_at desc);
create index verification_findings_run_idx on public.verification_findings(verification_run_id, rule_code);

create table public.duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  verification_run_id uuid,
  claim_id uuid not null references public.claims(id) on delete restrict,
  candidate_claim_id uuid not null references public.claims(id) on delete restrict,
  match_basis text not null check (match_basis in ('exact_file_hash', 'normalized_invoice_identity', 'field_similarity')),
  similarity numeric(5,4) check (similarity is null or similarity between 0 and 1),
  match_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(match_evidence) = 'object'),
  disposition text not null default 'candidate' check (disposition in ('candidate', 'reviewed', 'not_duplicate', 'confirmed_duplicate')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  check (claim_id <> candidate_claim_id),
  foreign key (verification_run_id, claim_id) references public.verification_runs(id, claim_id) on delete restrict,
  unique (claim_id, candidate_claim_id, match_basis)
);
create index duplicate_candidates_claim_created_idx on public.duplicate_candidates(claim_id, created_at desc);
create index duplicate_candidates_candidate_idx on public.duplicate_candidates(candidate_claim_id, created_at desc);

create table public.claim_status_history (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  claim_id uuid not null references public.claims(id) on delete restrict,
  previous_status text check (previous_status is null or previous_status in ('submitted', 'pending_buyer', 'disputed', 'needs_review', 'ready_for_review', 'reserved', 'financed', 'repaid', 'rejected')),
  new_status text not null check (new_status in ('submitted', 'pending_buyer', 'disputed', 'needs_review', 'ready_for_review', 'reserved', 'financed', 'repaid', 'rejected')),
  actor_id uuid references auth.users(id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 4000),
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now()
);
create index claim_status_history_claim_created_idx on public.claim_status_history(claim_id, created_at desc);

create or replace function public.log_claim_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status then
    insert into public.claim_status_history
      (claim_id, previous_status, new_status, actor_id, reason, record_source)
    values (new.id, old.status, new.status, (select auth.uid()),
      'Status changed by a trusted workflow.', new.record_source);
    insert into public.audit_events
      (claim_id, actor_id, event_type, event_payload, record_source)
    values (new.id, (select auth.uid()), 'claim_status_changed',
      jsonb_build_object('previous_status', old.status, 'new_status', new.status), new.record_source);
  end if;
  return new;
end;
$$;
revoke all on function public.log_claim_status_change() from public, anon, authenticated;
create trigger claims_status_history after update of status on public.claims
  for each row execute function public.log_claim_status_change();

alter table public.claim_buyer_responses alter column actor_id drop not null;
alter table public.claim_buyer_responses
  drop constraint if exists claim_buyer_responses_claim_id_fkey;
alter table public.claim_buyer_responses
  add constraint claim_buyer_responses_claim_id_fkey foreign key (claim_id) references public.claims(id) on delete restrict;
alter table public.claim_buyer_responses
  drop constraint if exists claim_buyer_responses_actor_id_fkey;
alter table public.claim_buyer_responses
  add constraint claim_buyer_responses_actor_id_fkey foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.claim_buyer_responses
  add column if not exists reason_code text not null default '' check (char_length(reason_code) <= 120),
  add column if not exists record_source text not null default 'user' check (record_source in ('user', 'system', 'synthetic'));

alter table public.claim_lender_reviews alter column actor_id drop not null;
alter table public.claim_lender_reviews
  drop constraint if exists claim_lender_reviews_claim_id_fkey;
alter table public.claim_lender_reviews
  add constraint claim_lender_reviews_claim_id_fkey foreign key (claim_id) references public.claims(id) on delete restrict;
alter table public.claim_lender_reviews
  drop constraint if exists claim_lender_reviews_actor_id_fkey;
alter table public.claim_lender_reviews
  add constraint claim_lender_reviews_actor_id_fkey foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.claim_lender_reviews
  add column if not exists record_source text not null default 'user' check (record_source in ('user', 'system', 'synthetic'));

create table public.buyer_payment_records (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  claim_id uuid references public.claims(id) on delete set null,
  invoice_reference text not null check (char_length(invoice_reference) between 1 and 160),
  currency char(3) not null check (currency = upper(currency)),
  amount numeric(18,2) not null check (amount > 0),
  invoice_date date,
  due_date date,
  paid_date date,
  outstanding_amount numeric(18,2) not null default 0 check (outstanding_amount >= 0 and outstanding_amount <= amount),
  source_type text not null check (source_type in ('synthetic', 'buyer_provided', 'accounting_integration', 'other')),
  source_reference text not null default '' check (char_length(source_reference) <= 500),
  record_source text not null default 'synthetic' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  check (paid_date is null or due_date is null or paid_date >= invoice_date)
);
create index buyer_payment_records_org_due_idx on public.buyer_payment_records(buyer_organization_id, due_date desc);
create index buyer_payment_records_claim_idx on public.buyer_payment_records(claim_id) where claim_id is not null;

create table public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  claim_id uuid not null references public.claims(id) on delete restrict,
  transaction_integrity_level text not null check (transaction_integrity_level in ('low', 'moderate', 'high', 'unknown')),
  methodology text not null check (char_length(methodology) between 1 and 160),
  methodology_version text not null default '' check (char_length(methodology_version) <= 80),
  explanation jsonb not null default '{}'::jsonb check (jsonb_typeof(explanation) = 'object'),
  source_coverage jsonb not null default '[]'::jsonb check (jsonb_typeof(source_coverage) = 'array'),
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now()
);
create index risk_assessments_claim_created_idx on public.risk_assessments(claim_id, created_at desc);

create table public.buyer_payment_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  claim_id uuid not null references public.claims(id) on delete restrict,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  risk_level text not null check (risk_level in ('low', 'moderate', 'high', 'unknown')),
  methodology text not null check (char_length(methodology) between 1 and 160),
  methodology_version text not null default '' check (char_length(methodology_version) <= 80),
  explanation jsonb not null default '{}'::jsonb check (jsonb_typeof(explanation) = 'object'),
  source_coverage jsonb not null default '[]'::jsonb check (jsonb_typeof(source_coverage) = 'array'),
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  foreign key (claim_id, buyer_organization_id)
    references public.claims(id, buyer_organization_id) on delete restrict
);
create index buyer_payment_risk_claim_created_idx
  on public.buyer_payment_risk_assessments(claim_id, created_at desc);

create table public.risk_assessment_factors (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  assessment_id uuid not null references public.risk_assessments(id) on delete restrict,
  dimension text not null check (dimension = 'transaction_integrity'),
  factor_code text not null check (factor_code ~ '^[A-Z0-9][A-Z0-9_.-]{0,119}$'),
  severity text not null check (severity in ('none', 'info', 'low', 'medium', 'high', 'critical')),
  explanation text not null check (char_length(explanation) between 1 and 2000),
  source_references jsonb not null default '[]'::jsonb check (jsonb_typeof(source_references) = 'array'),
  created_at timestamptz not null default now(),
  unique (assessment_id, factor_code)
);
create index risk_assessment_factors_assessment_idx on public.risk_assessment_factors(assessment_id, dimension);

create table public.buyer_payment_risk_factors (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  assessment_id uuid not null references public.buyer_payment_risk_assessments(id) on delete restrict,
  factor_code text not null check (factor_code ~ '^[A-Z0-9][A-Z0-9_.-]{0,119}$'),
  severity text not null check (severity in ('none', 'info', 'low', 'medium', 'high', 'critical')),
  explanation text not null check (char_length(explanation) between 1 and 2000),
  source_references jsonb not null default '[]'::jsonb check (jsonb_typeof(source_references) = 'array'),
  created_at timestamptz not null default now(),
  unique (assessment_id, factor_code)
);
create index buyer_payment_risk_factors_assessment_idx on public.buyer_payment_risk_factors(assessment_id);

alter table public.registry_reservations alter column actor_id drop not null;
alter table public.registry_reservations
  drop constraint if exists registry_reservations_actor_id_fkey;
alter table public.registry_reservations
  add constraint registry_reservations_actor_id_fkey foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.registry_reservations
  add column if not exists fixture_key text unique,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists financed_amount numeric(18,2),
  add column if not exists record_source text not null default 'user';
alter table public.registry_reservations
  add constraint registry_reservations_financed_amount_check check (financed_amount is null or financed_amount >= 0),
  add constraint registry_reservations_record_source_check check (record_source in ('user', 'system', 'synthetic')),
  add constraint registry_reservations_expiry_check check (reservation_expires_at is null or reservation_expires_at > created_at);
create index registry_reservations_lender_created_idx on public.registry_reservations(lender_organization_id, created_at desc);
alter table public.registry_reservations drop constraint if exists registry_reservations_status_check;
alter table public.registry_reservations add constraint registry_reservations_status_check
  check (status in ('reserved', 'partially_financed', 'financed', 'repaid', 'released', 'expired'));
drop index if exists public.registry_one_active_invoice_idx;
create unique index registry_one_active_invoice_idx on public.registry_reservations(normalized_invoice_key)
  where status in ('reserved', 'partially_financed', 'financed');

create table public.registry_checks (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  claim_id uuid not null references public.claims(id) on delete restrict,
  lender_organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  normalized_invoice_key text not null,
  outcome text not null check (outcome in ('available', 'match_found', 'conflict', 'unavailable', 'error')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  generic_message text not null default '' check (char_length(generic_message) <= 1000),
  record_source text not null default 'user' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now()
);
create index registry_checks_claim_created_idx on public.registry_checks(claim_id, created_at desc);
create index registry_checks_lender_created_idx on public.registry_checks(lender_organization_id, created_at desc);

create table public.registry_conflicts (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  registry_check_id uuid not null references public.registry_checks(id) on delete restrict,
  conflict_fingerprint text not null check (conflict_fingerprint ~ '^[0-9a-f]{64}$'),
  conflict_status text not null check (conflict_status in ('reserved', 'financed', 'unknown')),
  generic_message text not null default 'A participating registry conflict was found.' check (char_length(generic_message) <= 1000),
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  unique (registry_check_id, conflict_fingerprint)
);
create index registry_conflicts_check_idx on public.registry_conflicts(registry_check_id);

create table public.registry_reservation_events (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  reservation_id uuid not null references public.registry_reservations(id) on delete restrict,
  event_type text not null check (event_type in ('reserved', 'financed', 'partially_financed', 'released', 'expired', 'disputed', 'repaid')),
  previous_status text check (previous_status is null or previous_status in ('reserved', 'financed', 'released', 'expired')),
  new_status text not null check (new_status in ('reserved', 'financed', 'released', 'expired')),
  actor_id uuid references auth.users(id) on delete set null,
  amount numeric(18,2) check (amount is null or amount >= 0),
  note text not null default '' check (char_length(note) <= 2000),
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now()
);
create index registry_reservation_events_reservation_created_idx
  on public.registry_reservation_events(reservation_id, created_at desc);
alter table public.registry_reservation_events drop constraint if exists registry_reservation_events_previous_status_check;
alter table public.registry_reservation_events drop constraint if exists registry_reservation_events_new_status_check;
alter table public.registry_reservation_events
  add constraint registry_reservation_events_previous_status_check
    check (previous_status is null or previous_status in ('reserved', 'partially_financed', 'financed', 'repaid', 'released', 'expired')),
  add constraint registry_reservation_events_new_status_check
    check (new_status in ('reserved', 'partially_financed', 'financed', 'repaid', 'released', 'expired'));

create or replace function public.transition_claim_reservation(
  target_reservation_id uuid,
  next_status text,
  next_financed_amount numeric default null,
  transition_note text default ''
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  requester_id uuid := (select auth.uid());
  current_reservation public.registry_reservations%rowtype;
  claim_amount numeric(18,2);
  transition_event text;
begin
  if requester_id is null or next_status not in ('partially_financed', 'financed', 'repaid', 'released', 'expired') then
    return 'not_authorized';
  end if;

  select * into current_reservation
    from public.registry_reservations r
   where r.id = target_reservation_id
     and public.has_org_role(r.lender_organization_id, array['lender'])
     and exists (
       select 1 from public.claim_lender_assignments a
       where a.claim_id = r.claim_id and a.lender_organization_id = r.lender_organization_id
     )
   for update;
  if not found then return 'not_authorized'; end if;

  select c.amount into claim_amount from public.claims c where c.id = current_reservation.claim_id;
  if current_reservation.status = 'reserved'
     and next_status in ('partially_financed', 'financed', 'released', 'expired') then
    if next_status = 'expired' and (current_reservation.reservation_expires_at is null or current_reservation.reservation_expires_at > now()) then
      return 'invalid_transition';
    end if;
    if next_status in ('released', 'expired') and next_financed_amount is not null then
      return 'invalid_amount';
    end if;
    if next_status in ('partially_financed', 'financed') then
      if next_financed_amount is null or next_financed_amount <= 0 or next_financed_amount > claim_amount then
        return 'invalid_amount';
      end if;
      if next_status = 'partially_financed' and next_financed_amount >= claim_amount then
        return 'invalid_amount';
      end if;
    end if;
  elsif current_reservation.status = 'partially_financed' and next_status in ('financed', 'repaid') then
    if next_status = 'repaid' and next_financed_amount is not null then return 'invalid_amount'; end if;
    if next_status = 'financed' and (next_financed_amount is null or next_financed_amount <= coalesce(current_reservation.financed_amount, 0) or next_financed_amount > claim_amount) then
      return 'invalid_amount';
    end if;
  elsif current_reservation.status = 'financed' and next_status = 'repaid' then
    if next_financed_amount is not null then return 'invalid_amount'; end if;
    null;
  else
    return 'invalid_transition';
  end if;

  update public.registry_reservations
     set status = next_status,
         financed_amount = case when next_financed_amount is null then financed_amount else next_financed_amount end,
         updated_at = now()
   where id = target_reservation_id;

  transition_event := case next_status
    when 'repaid' then 'repaid'
    when 'released' then 'released'
    when 'expired' then 'expired'
    when 'partially_financed' then 'partially_financed'
    else 'financed'
  end;
  insert into public.registry_reservation_events
    (reservation_id, event_type, previous_status, new_status, actor_id, amount, note, record_source)
  values (target_reservation_id, transition_event, current_reservation.status, next_status,
    requester_id, next_financed_amount, left(coalesce(transition_note, ''), 2000), 'user');
  insert into public.audit_events (claim_id, actor_id, event_type, event_payload, record_source)
  values (current_reservation.claim_id, requester_id,
    case when next_status = 'released' then 'reservation_released'
         when next_status = 'expired' then 'reservation_expired'
         else 'financing_recorded' end,
    jsonb_build_object('reservation_id', target_reservation_id, 'new_status', next_status), 'system');
  return next_status;
end;
$$;
revoke all on function public.transition_claim_reservation(uuid, text, numeric, text) from public, anon;
grant execute on function public.transition_claim_reservation(uuid, text, numeric, text) to authenticated;

alter table public.audit_events alter column actor_id drop not null;
alter table public.audit_events
  drop constraint if exists audit_events_claim_id_fkey;
alter table public.audit_events
  add constraint audit_events_claim_id_fkey foreign key (claim_id) references public.claims(id) on delete restrict;
alter table public.audit_events
  add column if not exists record_source text not null default 'system';
alter table public.audit_events drop constraint if exists audit_events_event_type_check;
alter table public.audit_events
  add constraint audit_events_event_type_check check (event_type in (
    'claim_created', 'claim_status_changed', 'document_added', 'extraction_completed',
    'verification_completed', 'buyer_responded', 'dispute_recorded', 'review_recorded',
    'registry_checked', 'reservation_created', 'reservation_released', 'reservation_expired', 'financing_recorded',
    'payment_history_imported', 'anchor_submitted', 'anchor_confirmed'
  )),
  add constraint audit_events_record_source_check check (record_source in ('user', 'system', 'synthetic'));

create table public.chain_anchors (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  claim_id uuid not null references public.claims(id) on delete restrict,
  audit_event_id uuid references public.audit_events(id) on delete set null,
  document_id uuid references public.claim_documents(id) on delete set null,
  anchor_type text not null check (anchor_type in ('submission_manifest', 'registry_event', 'final_review')),
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  chain_id numeric(78,0),
  contract_address text,
  transaction_hash text,
  block_number numeric(78,0),
  status text not null default 'queued' check (status in ('queued', 'submitted', 'anchored', 'failed', 'verification_failed')),
  anchored_at timestamptz,
  error_code text not null default '' check (char_length(error_code) <= 120),
  error_summary text not null default '' check (char_length(error_summary) <= 2000),
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  demo_note text not null default '',
  created_at timestamptz not null default now(),
  check (chain_id is null or chain_id > 0),
  check (block_number is null or block_number >= 0),
  check (contract_address is null or contract_address ~ '^0x[0-9a-fA-F]{40}$'),
  check (transaction_hash is null or transaction_hash ~ '^0x[0-9a-fA-F]{64}$'),
  check (status <> 'anchored' or (transaction_hash is not null and block_number is not null and anchored_at is not null))
);
create index chain_anchors_claim_created_idx on public.chain_anchors(claim_id, created_at desc);
create unique index chain_anchors_tx_hash_idx on public.chain_anchors(transaction_hash) where transaction_hash is not null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  recipient_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  claim_id uuid references public.claims(id) on delete set null,
  notification_type text not null check (notification_type in ('buyer_response_needed', 'claim_status_changed', 'verification_complete', 'registry_conflict', 'review_assigned', 'anchor_status')),
  title text not null check (char_length(title) between 1 and 180),
  body text not null default '' check (char_length(body) <= 2000),
  route_key text not null default 'dashboard' check (route_key ~ '^[a-z][a-z0-9-]{0,79}$'),
  record_source text not null default 'system' check (record_source in ('user', 'system', 'synthetic')),
  created_at timestamptz not null default now(),
  check (recipient_user_id is not null or organization_id is not null)
);
create index notifications_recipient_created_idx on public.notifications(recipient_user_id, created_at desc);
create index notifications_org_created_idx on public.notifications(organization_id, created_at desc);

create table public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
create index notification_reads_user_idx on public.notification_reads(user_id, read_at desc);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'en' check (locale ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  timezone_name text not null default 'UTC' check (char_length(timezone_name) between 1 and 80),
  email_notifications boolean not null default true,
  in_app_notifications boolean not null default true,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger user_preferences_touch_updated_at before update on public.user_preferences
  for each row execute function public.touch_updated_at();

create or replace function public.can_access_buyer_payment_records(target_buyer_organization_id uuid, target_claim_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_org_role(target_buyer_organization_id, array['buyer'])
    or (target_claim_id is not null and exists (
      select 1 from public.claims c
      join public.claim_lender_assignments a on a.claim_id = c.id
      where c.id = target_claim_id
        and c.buyer_organization_id = target_buyer_organization_id
        and public.has_org_role(a.lender_organization_id, array['lender'])
    )
    );
$$;
revoke all on function public.can_access_buyer_payment_records(uuid, uuid) from public, anon;
grant execute on function public.can_access_buyer_payment_records(uuid, uuid) to authenticated;

create or replace function public.enforce_membership_organization_kind()
returns trigger language plpgsql security definer set search_path = '' as $$
declare organization_kind text;
begin
  select o.kind into organization_kind from public.organizations o where o.id = new.organization_id;
  if organization_kind is null or organization_kind <> new.role then
    raise exception 'membership role must match the organization kind';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_membership_organization_kind() from public, anon, authenticated;
create trigger membership_organization_kind_check before insert or update of organization_id, role
  on public.organization_memberships for each row execute function public.enforce_membership_organization_kind();

-- Application data is private by default. New tables grant only their documented operations.
revoke all on public.organization_access_request_events, public.claim_line_items,
  public.document_extractions, public.document_extracted_fields, public.verification_runs,
  public.verification_findings, public.duplicate_candidates, public.claim_status_history,
  public.buyer_payment_records, public.risk_assessments, public.risk_assessment_factors,
  public.buyer_payment_risk_assessments, public.buyer_payment_risk_factors,
  public.registry_checks, public.registry_conflicts, public.registry_reservation_events,
  public.chain_anchors, public.notifications, public.notification_reads, public.user_preferences from anon, authenticated;

grant select on public.organization_access_request_events, public.claim_line_items,
  public.document_extractions, public.document_extracted_fields, public.verification_runs,
  public.verification_findings, public.duplicate_candidates, public.claim_status_history,
  public.buyer_payment_records, public.risk_assessments, public.risk_assessment_factors,
  public.buyer_payment_risk_assessments, public.buyer_payment_risk_factors,
  public.registry_checks, public.registry_conflicts, public.registry_reservation_events,
  public.chain_anchors, public.notifications, public.notification_reads, public.user_preferences to authenticated;
grant insert (user_id, locale, timezone_name, email_notifications, in_app_notifications, preferences)
  on public.user_preferences to authenticated;
grant update (locale, timezone_name, email_notifications, in_app_notifications, preferences)
  on public.user_preferences to authenticated;
grant insert (notification_id, user_id) on public.notification_reads to authenticated;
grant update (read_at) on public.notification_reads to authenticated;

alter table public.organization_access_request_events enable row level security;
alter table public.claim_line_items enable row level security;
alter table public.document_extractions enable row level security;
alter table public.document_extracted_fields enable row level security;
alter table public.verification_runs enable row level security;
alter table public.verification_findings enable row level security;
alter table public.duplicate_candidates enable row level security;
alter table public.claim_status_history enable row level security;
alter table public.buyer_payment_records enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.risk_assessment_factors enable row level security;
alter table public.buyer_payment_risk_assessments enable row level security;
alter table public.buyer_payment_risk_factors enable row level security;
alter table public.registry_checks enable row level security;
alter table public.registry_conflicts enable row level security;
alter table public.registry_reservation_events enable row level security;
alter table public.chain_anchors enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.user_preferences enable row level security;

create policy access_request_events_read_self on public.organization_access_request_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy claim_line_items_read_participants on public.claim_line_items
  for select to authenticated using (public.can_access_claim(claim_id));
create policy document_extractions_read_participants on public.document_extractions
  for select to authenticated using (public.can_access_claim(claim_id));
create policy document_fields_read_participants on public.document_extracted_fields
  for select to authenticated using (public.can_access_claim(claim_id));
create policy verification_runs_read_participants on public.verification_runs
  for select to authenticated using (public.can_access_claim(claim_id));
create policy verification_findings_read_participants on public.verification_findings
  for select to authenticated using (public.can_access_claim(claim_id));
create policy duplicate_candidates_read_both_claims on public.duplicate_candidates
  for select to authenticated using (public.can_access_claim(claim_id) and public.can_access_claim(candidate_claim_id));
create policy claim_status_history_read_participants on public.claim_status_history
  for select to authenticated using (public.can_access_claim(claim_id));
create policy buyer_payment_records_read_authorized on public.buyer_payment_records
  for select to authenticated using (public.can_access_buyer_payment_records(buyer_organization_id, claim_id));
create policy risk_assessments_read_participants on public.risk_assessments
  for select to authenticated using (public.can_access_claim(claim_id));
create policy risk_factors_read_authorized on public.risk_assessment_factors
  for select to authenticated using (
    exists (select 1 from public.risk_assessments r where r.id = assessment_id and public.can_access_claim(r.claim_id))
  );
create policy buyer_payment_risk_read_authorized on public.buyer_payment_risk_assessments
  for select to authenticated using (public.can_access_buyer_payment_records(buyer_organization_id, claim_id));
create policy buyer_payment_risk_factors_read_authorized on public.buyer_payment_risk_factors
  for select to authenticated using (
    exists (
      select 1 from public.buyer_payment_risk_assessments r
      where r.id = assessment_id and public.can_access_buyer_payment_records(r.buyer_organization_id, r.claim_id)
    )
  );
create policy registry_checks_read_own_lender on public.registry_checks
  for select to authenticated using (
    public.has_org_role(lender_organization_id, array['lender'])
    and (actor_id = (select auth.uid()) or record_source = 'synthetic')
  );
create policy registry_conflicts_read_own_check on public.registry_conflicts
  for select to authenticated using (
    exists (
      select 1 from public.registry_checks c where c.id = registry_check_id
        and public.has_org_role(c.lender_organization_id, array['lender'])
        and (c.actor_id = (select auth.uid()) or c.record_source = 'synthetic')
    )
  );
create policy registry_events_read_assigned_lender on public.registry_reservation_events
  for select to authenticated using (
    exists (
      select 1 from public.registry_reservations r
      where r.id = reservation_id
        and public.has_org_role(r.lender_organization_id, array['lender'])
        and exists (select 1 from public.claim_lender_assignments a where a.claim_id = r.claim_id and a.lender_organization_id = r.lender_organization_id)
    )
  );
create policy chain_anchors_read_participants on public.chain_anchors
  for select to authenticated using (public.can_access_claim(claim_id));
create policy notifications_read_recipient on public.notifications
  for select to authenticated using (
    recipient_user_id = (select auth.uid())
    or (recipient_user_id is null and organization_id is not null and exists (
      select 1 from public.organization_memberships m
      where m.organization_id = notifications.organization_id and m.user_id = (select auth.uid())
    ))
  );
create policy notification_reads_read_self on public.notification_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_reads_insert_self on public.notification_reads
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notifications n
      where n.id = notification_id
        and (n.recipient_user_id = (select auth.uid()) or exists (
          select 1 from public.organization_memberships m
          where n.recipient_user_id is null and n.organization_id is not null
            and m.organization_id = n.organization_id and m.user_id = (select auth.uid())
        ))
    )
  );
create policy notification_reads_update_self on public.notification_reads
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy preferences_read_self on public.user_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy preferences_insert_self on public.user_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy preferences_update_self on public.user_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Synthetic demo rows are read-only and never create Auth users or memberships.
drop policy if exists documents_insert_seller on public.claim_documents;
create policy documents_insert_seller on public.claim_documents for insert to authenticated
  with check (
    record_source = 'user'
    and uploaded_by = (select auth.uid())
    and public.can_access_claim(claim_id)
    and public.has_org_role((select c.seller_organization_id from public.claims c where c.id = claim_id), array['seller'])
    and source_type = 'seller_submitted'
    and storage_path is not null
    and (
      split_part(storage_path, '/', 1) = claim_id::text
      and split_part(storage_path, '/', 2) = (select auth.uid())::text
      and storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  );

drop policy if exists buyer_responses_insert_authorized_buyer on public.claim_buyer_responses;
create policy buyer_responses_insert_authorized_buyer on public.claim_buyer_responses for insert to authenticated
  with check (
    record_source = 'user'
    and actor_id = (select auth.uid())
    and exists (select 1 from public.claims c where c.id = claim_buyer_responses.claim_id and c.buyer_organization_id = claim_buyer_responses.buyer_organization_id)
    and public.has_org_role(claim_buyer_responses.buyer_organization_id, array['buyer'])
  );

drop policy if exists lender_reviews_insert_assigned_lender on public.claim_lender_reviews;
create policy lender_reviews_insert_assigned_lender on public.claim_lender_reviews for insert to authenticated
  with check (
    record_source = 'user'
    and actor_id = (select auth.uid())
    and public.has_org_role(lender_organization_id, array['lender'])
    and exists (select 1 from public.claim_lender_assignments a where a.claim_id = claim_lender_reviews.claim_id and a.lender_organization_id = claim_lender_reviews.lender_organization_id)
  );

drop policy if exists registry_insert_assigned_lender on public.registry_reservations;
revoke insert on public.registry_reservations from authenticated;

-- All reservations go through this authenticated, atomic function. The unique
-- active-key index remains the final concurrency guard. Conflicts return only a
-- generic result to avoid disclosing another participant's reservation details.
create or replace function public.reserve_claim(
  target_claim_id uuid,
  target_lender_organization_id uuid,
  reservation_hours integer default 24
)
returns table (outcome text, reservation_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  requester_id uuid := (select auth.uid());
  invoice_key text;
  new_reservation_id uuid;
  new_check_id uuid;
  result_outcome text;
begin
  if requester_id is null or reservation_hours is null or reservation_hours < 1 or reservation_hours > 720 then
    return query select 'not_authorized'::text, null::uuid;
    return;
  end if;

  select lower(regexp_replace(
      c.seller_organization_id::text || ':' || c.buyer_organization_id::text || ':' || trim(c.invoice_number),
      '\s+', '', 'g'
    ))
    into invoice_key
  from public.claims c
  join public.claim_lender_assignments a on a.claim_id = c.id
  where c.id = target_claim_id
    and c.status = 'ready_for_review'
    and a.lender_organization_id = target_lender_organization_id
    and public.has_org_role(target_lender_organization_id, array['lender']);

  if invoice_key is null then
    return query select 'not_authorized'::text, null::uuid;
    return;
  end if;

  with expired as (
    update public.registry_reservations r
       set status = 'expired', updated_at = now()
     where r.normalized_invoice_key = invoice_key
       and r.status = 'reserved'
       and r.reservation_expires_at is not null
       and r.reservation_expires_at <= now()
    returning r.id, r.claim_id
  ), reservation_events as (
    insert into public.registry_reservation_events
      (reservation_id, event_type, previous_status, new_status, actor_id, note, record_source)
    select e.id, 'expired', 'reserved', 'expired', requester_id,
      'Expired during an authorized atomic reservation check.', 'system'
    from expired e
    returning reservation_id
  )
  insert into public.audit_events (claim_id, actor_id, event_type, event_payload, record_source)
  select e.claim_id, requester_id, 'reservation_expired',
    jsonb_build_object('reservation_id', e.id, 'new_status', 'expired'), 'system'
  from expired e;

  begin
    insert into public.registry_reservations
      (claim_id, lender_organization_id, actor_id, normalized_invoice_key,
       status, reservation_expires_at, record_source)
    values (target_claim_id, target_lender_organization_id, requester_id, invoice_key,
       'reserved', now() + make_interval(hours => reservation_hours), 'user')
    returning id into new_reservation_id;
    result_outcome := 'reserved';
  exception when unique_violation then
    new_reservation_id := null;
    result_outcome := 'conflict';
  end;

  insert into public.registry_checks
    (claim_id, lender_organization_id, actor_id, normalized_invoice_key,
     outcome, candidate_count, generic_message, record_source)
  values (
    target_claim_id, target_lender_organization_id, requester_id, invoice_key,
    case when result_outcome = 'reserved' then 'available' else 'conflict' end,
    case when result_outcome = 'reserved' then 0 else 1 end,
    case when result_outcome = 'reserved'
      then 'No conflicting active reservation was found.'
      else 'A participating registry conflict was found; details are restricted.' end,
    'user'
  ) returning id into new_check_id;

  if result_outcome = 'reserved' then
    insert into public.registry_reservation_events
      (reservation_id, event_type, previous_status, new_status, actor_id, note, record_source)
    values (new_reservation_id, 'reserved', null, 'reserved', requester_id,
      'Authorized reservation created atomically.', 'user');
    insert into public.audit_events (claim_id, actor_id, event_type, event_payload, record_source)
    values (target_claim_id, requester_id, 'reservation_created',
      jsonb_build_object('reservation_id', new_reservation_id), 'system');
  else
    insert into public.registry_conflicts
      (registry_check_id, conflict_fingerprint, conflict_status, generic_message, record_source)
    values (new_check_id, md5(invoice_key) || md5('mei-registry-conflict:' || invoice_key),
      'unknown', 'A participating registry conflict was found; details are restricted.', 'system');
  end if;

  return query select result_outcome, new_reservation_id;
end;
$$;
revoke all on function public.reserve_claim(uuid, uuid, integer) from public, anon;
grant execute on function public.reserve_claim(uuid, uuid, integer) to authenticated;

create or replace function public.claim_id_from_evidence_path(object_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
declare path_claim_id text;
begin
  path_claim_id := split_part(object_name, '/', 1);
  if path_claim_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return path_claim_id::uuid;
end;
$$;
revoke all on function public.claim_id_from_evidence_path(text) from public, anon;
grant execute on function public.claim_id_from_evidence_path(text) to authenticated;

drop policy if exists evidence_read_claim_participants on storage.objects;
create policy evidence_read_claim_participants on storage.objects for select to authenticated
  using (
    bucket_id = 'claim-evidence'
    and public.can_access_claim(public.claim_id_from_evidence_path(name))
    and exists (
      select 1 from public.claim_documents d
      where d.storage_path = name and d.claim_id = public.claim_id_from_evidence_path(name)
    )
  );
drop policy if exists evidence_insert_claim_seller on storage.objects;
create policy evidence_insert_claim_seller on storage.objects for insert to authenticated
  with check (
    bucket_id = 'claim-evidence'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(name, '/', 2) = (select auth.uid())::text
    and exists (
      select 1 from public.claims c
      where c.id = public.claim_id_from_evidence_path(name)
        and public.has_org_role(c.seller_organization_id, array['seller'])
    )
  );

-- Ensure all application tables are under RLS and ordinary clients have no
-- mutation path for approvals, claims, extraction, verification, audit, or anchors.
revoke insert, update, delete on public.organizations, public.organization_memberships,
  public.organization_access_requests, public.organization_access_request_events,
  public.claims, public.claim_lender_assignments, public.claim_line_items,
  public.document_extractions, public.document_extracted_fields, public.verification_runs,
  public.verification_findings, public.duplicate_candidates, public.claim_status_history,
  public.buyer_payment_records, public.risk_assessments, public.risk_assessment_factors,
  public.buyer_payment_risk_assessments, public.buyer_payment_risk_factors,
  public.audit_events, public.registry_checks, public.registry_conflicts,
  public.registry_reservation_events, public.chain_anchors from anon, authenticated;

commit;
