-- MeiProof MVP schema. This supports review workflows; it does not verify invoices.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  name text not null check (char_length(name) between 1 and 180),
  kind text not null check (kind in ('seller', 'buyer', 'lender')),
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('seller', 'buyer', 'lender')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  check (role in ('seller', 'buyer', 'lender'))
);
create index organization_memberships_user_idx on public.organization_memberships(user_id, role);

create table public.organization_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 160),
  organization_name text not null check (char_length(organization_name) between 1 and 180),
  requested_role text not null check (requested_role in ('seller', 'buyer', 'lender')),
  country text not null default '' check (char_length(country) <= 100),
  business_identifier text not null default '' check (char_length(business_identifier) <= 100),
  website text not null default '' check (char_length(website) <= 255),
  phone text not null default '' check (char_length(phone) <= 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table public.claim_lender_assignments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null,
  lender_organization_id uuid not null references public.organizations(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (claim_id, lender_organization_id)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  seller_organization_id uuid not null references public.organizations(id) on delete restrict,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  invoice_number text not null check (char_length(invoice_number) between 1 and 120),
  invoice_date date,
  due_date date,
  currency char(3) not null check (currency = upper(currency)),
  amount numeric(18,2) not null check (amount > 0),
  status text not null default 'submitted' check (status in ('submitted', 'pending_buyer', 'disputed', 'needs_review', 'ready_for_review', 'reserved', 'financed', 'repaid', 'rejected')),
  demo_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or invoice_date is null or due_date >= invoice_date)
);
create index claims_seller_created_idx on public.claims(seller_organization_id, created_at desc);
create index claims_buyer_created_idx on public.claims(buyer_organization_id, created_at desc);
create index claims_status_created_idx on public.claims(status, created_at desc);
create index claim_lender_assignments_org_idx on public.claim_lender_assignments(lender_organization_id, claim_id);
alter table public.claim_lender_assignments
  add constraint claim_lender_assignments_claim_fk foreign key (claim_id) references public.claims(id) on delete cascade;

create table public.claim_documents (
  id uuid primary key default gen_random_uuid(),
  fixture_key text unique,
  claim_id uuid not null references public.claims(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (char_length(mime_type) <= 120),
  size_bytes bigint not null check (size_bytes > 0),
  storage_path text unique,
  demo_note text not null default '',
  created_at timestamptz not null default now(),
  check (storage_path is null or storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$')
);
create index claim_documents_claim_created_idx on public.claim_documents(claim_id, created_at desc);

create table public.claim_buyer_responses (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  response text not null check (response in ('confirmed', 'disputed', 'correction_requested')),
  comment text not null default '' check (char_length(comment) <= 4000),
  created_at timestamptz not null default now()
);
create index claim_buyer_responses_claim_created_idx on public.claim_buyer_responses(claim_id, created_at desc);

create table public.claim_lender_reviews (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  lender_organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('pending', 'request_information', 'declined', 'approved_for_financing')),
  note text not null default '' check (char_length(note) <= 4000),
  created_at timestamptz not null default now()
);
create index claim_lender_reviews_claim_created_idx on public.claim_lender_reviews(claim_id, created_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('claim_created', 'document_added', 'buyer_responded', 'review_recorded', 'reservation_created')),
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_claim_created_idx on public.audit_events(claim_id, created_at desc);

create table public.registry_reservations (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete restrict,
  lender_organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  normalized_invoice_key text not null,
  status text not null default 'reserved' check (status in ('reserved', 'financed', 'released', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index registry_one_active_invoice_idx on public.registry_reservations(normalized_invoice_key)
  where status in ('reserved', 'financed');
create index registry_reservations_claim_idx on public.registry_reservations(claim_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger claims_touch_updated_at before update on public.claims
  for each row execute function public.touch_updated_at();
create trigger reservations_touch_updated_at before update on public.registry_reservations
  for each row execute function public.touch_updated_at();

-- Only creates a profile and an untrusted access request from signup metadata.
-- It never grants an organization membership or role.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_role text := metadata ->> 'requested_role';
  requested_org text := left(trim(coalesce(metadata ->> 'organization_name', '')), 180);
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(trim(coalesce(metadata ->> 'display_name', '')), 160))
  on conflict (id) do nothing;

  if requested_org <> '' and requested_role in ('seller', 'buyer', 'lender') then
    insert into public.organization_access_requests
      (user_id, display_name, organization_name, requested_role, country, business_identifier, website, phone)
    values (
      new.id,
      left(trim(coalesce(metadata ->> 'display_name', '')), 160),
      requested_org,
      requested_role,
      left(trim(coalesce(metadata ->> 'country', '')), 100),
      left(trim(coalesce(metadata ->> 'business_identifier', '')), 100),
      left(trim(coalesce(metadata ->> 'website', '')), 255),
      left(trim(coalesce(metadata ->> 'phone', '')), 80)
    ) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = org_id and m.user_id = (select auth.uid()) and m.role = any(allowed_roles)
  );
$$;

create or replace function public.can_access_claim(target_claim_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.claims c
    where c.id = target_claim_id and (
      public.has_org_role(c.seller_organization_id, array['seller'])
      or public.has_org_role(c.buyer_organization_id, array['buyer'])
      or exists (
        select 1 from public.claim_lender_assignments a
        where a.claim_id = c.id and public.has_org_role(a.lender_organization_id, array['lender'])
      )
    )
  );
$$;

grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.can_access_claim(uuid) to authenticated;
revoke all on function public.has_org_role(uuid, text[]) from public, anon;
revoke all on function public.can_access_claim(uuid) from public, anon;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

revoke all on public.profiles, public.organizations, public.organization_memberships,
  public.organization_access_requests, public.claim_lender_assignments,
  public.claims, public.claim_documents, public.claim_buyer_responses,
  public.claim_lender_reviews, public.audit_events, public.registry_reservations from anon, authenticated;
grant select on public.profiles, public.organizations, public.organization_memberships,
  public.organization_access_requests, public.claim_lender_assignments,
  public.claims, public.claim_documents, public.claim_buyer_responses,
  public.claim_lender_reviews, public.audit_events, public.registry_reservations to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert on public.claim_documents, public.claim_buyer_responses,
  public.claim_lender_reviews, public.registry_reservations to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_access_requests enable row level security;
alter table public.claim_lender_assignments enable row level security;
alter table public.claims enable row level security;
alter table public.claim_documents enable row level security;
alter table public.claim_buyer_responses enable row level security;
alter table public.claim_lender_reviews enable row level security;
alter table public.audit_events enable row level security;
alter table public.registry_reservations enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy organizations_read_member on public.organizations for select to authenticated
  using (exists (select 1 from public.organization_memberships m where m.organization_id = organizations.id and m.user_id = (select auth.uid())));
create policy memberships_read_self on public.organization_memberships for select to authenticated using (user_id = (select auth.uid()));
create policy access_requests_read_self on public.organization_access_requests for select to authenticated using (user_id = (select auth.uid()));
create policy claims_read_participants on public.claims for select to authenticated using (public.can_access_claim(id));
create policy assignments_read_assigned_lender on public.claim_lender_assignments for select to authenticated
  using (public.has_org_role(lender_organization_id, array['lender']) and public.can_access_claim(claim_id));
create policy documents_read_participants on public.claim_documents for select to authenticated using (public.can_access_claim(claim_id));
create policy documents_insert_seller on public.claim_documents for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and public.can_access_claim(claim_id)
    and (storage_path is null or split_part(storage_path, '/', 1) = claim_id::text and split_part(storage_path, '/', 2) = (select auth.uid())::text)
  );
create policy buyer_responses_read_participants on public.claim_buyer_responses for select to authenticated using (public.can_access_claim(claim_id));
create policy buyer_responses_insert_authorized_buyer on public.claim_buyer_responses for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and exists (select 1 from public.claims c where c.id = claim_buyer_responses.claim_id and c.buyer_organization_id = claim_buyer_responses.buyer_organization_id)
    and public.has_org_role(claim_buyer_responses.buyer_organization_id, array['buyer'])
  );
create policy lender_reviews_read_assigned_lender on public.claim_lender_reviews for select to authenticated
  using (
    public.has_org_role(lender_organization_id, array['lender'])
    and exists (select 1 from public.claim_lender_assignments a where a.claim_id = claim_lender_reviews.claim_id and a.lender_organization_id = claim_lender_reviews.lender_organization_id)
  );
create policy lender_reviews_insert_assigned_lender on public.claim_lender_reviews for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and public.has_org_role(lender_organization_id, array['lender'])
    and exists (select 1 from public.claim_lender_assignments a where a.claim_id = claim_lender_reviews.claim_id and a.lender_organization_id = claim_lender_reviews.lender_organization_id)
  );
create policy audit_events_read_participants on public.audit_events for select to authenticated using (public.can_access_claim(claim_id));
create policy registry_read_assigned_lender on public.registry_reservations for select to authenticated
  using (public.has_org_role(lender_organization_id, array['lender']) and public.can_access_claim(claim_id));
create policy registry_insert_assigned_lender on public.registry_reservations for insert to authenticated
  with check (
    actor_id = (select auth.uid()) and status = 'reserved'
    and public.has_org_role(lender_organization_id, array['lender'])
    and exists (select 1 from public.claim_lender_assignments a where a.claim_id = registry_reservations.claim_id and a.lender_organization_id = registry_reservations.lender_organization_id)
    and normalized_invoice_key = (
      select lower(regexp_replace(c.seller_organization_id::text || ':' || c.buyer_organization_id::text || ':' || trim(c.invoice_number), '\s+', '', 'g'))
      from public.claims c where c.id = registry_reservations.claim_id
    )
  );

-- Append-only for authenticated clients; no update/delete policies are defined.
-- Trusted administration may still operate outside normal client RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claim-evidence', 'claim-evidence', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.validate_claim_document_object()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.storage_path is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'claim-evidence' and o.name = new.storage_path
  ) then
    raise exception 'claim document storage object does not exist';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_claim_document_object() from public, anon, authenticated;
create trigger claim_document_object_must_exist before insert on public.claim_documents
  for each row execute function public.validate_claim_document_object();

create policy evidence_read_claim_participants on storage.objects for select to authenticated
  using (
    bucket_id = 'claim-evidence'
    and public.can_access_claim((split_part(name, '/', 1))::uuid)
    and exists (
      select 1 from public.claim_documents d
      where d.storage_path = name and d.claim_id = (split_part(name, '/', 1))::uuid
    )
  );
create policy evidence_insert_claim_seller on storage.objects for insert to authenticated
  with check (
    bucket_id = 'claim-evidence'
    and split_part(name, '/', 2) = (select auth.uid())::text
    and split_part(name, '/', 3) ~ '^[0-9a-f-]{36}$'
    and array_length(string_to_array(name, '/'), 1) = 3
    and public.has_org_role(
      (select c.seller_organization_id from public.claims c where c.id = (split_part(name, '/', 1))::uuid),
      array['seller']
    )
  );
