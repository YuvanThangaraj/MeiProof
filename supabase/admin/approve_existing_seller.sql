-- Run only in the SQL Editor of the verified MeiProof development project.
-- Replace the email below with the exact, already-confirmed Supabase Auth email.
-- This script grants seller access only, and only from a seller access request.
begin;
do $$
declare
  target_email text := lower(trim('REPLACE_WITH_EXACT_CONFIRMED_AUTH_EMAIL'));
  target_user_id uuid;
  target_request public.organization_access_requests%rowtype;
  target_organization_id uuid;
  matching_organizations integer;
begin
  if target_email = '' or target_email like 'replace_with_%' then
    raise exception 'Replace the email placeholder with the exact confirmed Auth email.';
  end if;

  select u.id into strict target_user_id
    from auth.users u
   where lower(u.email) = target_email and u.email_confirmed_at is not null;

  select r.* into strict target_request
    from public.organization_access_requests r
   where r.user_id = target_user_id;

  if target_request.requested_role <> 'seller' then
    raise exception 'This request is not for the seller role; no membership was granted.';
  end if;
  if target_request.status = 'rejected' then
    raise exception 'This access request was rejected; review it before retrying.';
  end if;

  select count(*) into matching_organizations
    from public.organizations o
   where o.kind = 'seller' and lower(trim(o.name)) = lower(trim(target_request.organization_name));

  if matching_organizations > 1 then
    raise exception 'Multiple seller organizations have this name; resolve the organization match manually.';
  elsif matching_organizations = 1 then
    select o.id into strict target_organization_id
      from public.organizations o
     where o.kind = 'seller' and lower(trim(o.name)) = lower(trim(target_request.organization_name));
  else
    insert into public.organizations
      (name, kind, country, business_identifier, website, record_source)
    values (
      target_request.organization_name,
      'seller',
      target_request.country,
      target_request.business_identifier,
      target_request.website,
      'system'
    ) returning id into target_organization_id;
  end if;

  insert into public.profiles (id, display_name)
  values (target_user_id, target_request.display_name)
  on conflict (id) do nothing;

  update public.organization_access_requests
     set status = 'approved', reviewed_at = now(), reviewed_by = null,
         review_note = 'Seller access approved by a Supabase project administrator.'
   where id = target_request.id and status = 'pending';

  if exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_organization_id
      and m.user_id = target_user_id and m.role <> 'seller'
  ) then
    raise exception 'The existing membership role conflicts with seller approval; no role was changed.';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (target_organization_id, target_user_id, 'seller')
  on conflict (organization_id, user_id) do nothing;

  insert into public.organization_access_request_events
    (fixture_key, access_request_id, user_id, organization_id, event_type,
     previous_status, new_status, note, record_source)
  values (
    'admin-membership-' || target_request.id::text,
    target_request.id,
    target_user_id,
    target_organization_id,
    'membership_granted',
    'approved',
    'approved',
    'Seller membership was granted by a trusted administrator.',
    'admin'
  )
  on conflict (fixture_key) do nothing;
end;
$$;
commit;
