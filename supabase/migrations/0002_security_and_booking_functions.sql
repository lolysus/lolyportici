create or replace function public.current_staff_org_ids()
returns setof uuid language sql stable security definer set search_path = public, pg_temp as $$
  select organization_id from public.staff_users where auth_user_id = auth.uid() and status = 'active';
$$;

create or replace function public.can_access_location(p_location_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.locations l
    join public.restaurants r on r.id = l.restaurant_id
    where l.id = p_location_id and r.organization_id in (select public.current_staff_org_ids())
  );
$$;

revoke all on function public.current_staff_org_ids() from public;
revoke all on function public.can_access_location(uuid) from public;
grant execute on function public.current_staff_org_ids() to authenticated, service_role;
grant execute on function public.can_access_location(uuid) to authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.restaurants enable row level security;
alter table public.locations enable row level security;
alter table public.dining_areas enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.table_combinations enable row level security;
alter table public.table_combination_items enable row level security;
alter table public.service_periods enable row level security;
alter table public.special_openings_closures enable row level security;
alter table public.booking_rules enable row level security;
alter table public.customers enable row level security;
alter table public.customer_preferences enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_table_assignments enable row level security;
alter table public.reservation_notes enable row level security;
alter table public.reservation_events enable row level security;
alter table public.reservation_holds enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.staff_users enable row level security;
alter table public.roles enable row level security;
alter table public.staff_user_roles enable row level security;
alter table public.voice_calls enable row level security;
alter table public.notifications enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.idempotency_keys enable row level security;

create policy organizations_staff_select on public.organizations for select to authenticated using (id in (select public.current_staff_org_ids()));
create policy organizations_staff_update on public.organizations for update to authenticated using (id in (select public.current_staff_org_ids())) with check (id in (select public.current_staff_org_ids()));
create policy restaurants_staff_all on public.restaurants for all to authenticated using (organization_id in (select public.current_staff_org_ids())) with check (organization_id in (select public.current_staff_org_ids()));
create policy locations_staff_all on public.locations for all to authenticated using (public.can_access_location(id)) with check (public.can_access_location(id));
create policy dining_areas_staff_all on public.dining_areas for all to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id));
create policy tables_staff_all on public.restaurant_tables for all to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id));
create policy combinations_staff_all on public.table_combinations for all to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id));
create policy combination_items_staff_all on public.table_combination_items for all to authenticated using (exists (select 1 from public.table_combinations c where c.id = table_combination_id and public.can_access_location(c.location_id))) with check (exists (select 1 from public.table_combinations c where c.id = table_combination_id and public.can_access_location(c.location_id)));
create policy service_periods_staff_all on public.service_periods for all to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id));
create policy closures_staff_all on public.special_openings_closures for all to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id));
create policy rules_staff_all on public.booking_rules for all to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id));
create policy customers_staff_all on public.customers for all to authenticated using (organization_id in (select public.current_staff_org_ids())) with check (organization_id in (select public.current_staff_org_ids()));
create policy preferences_staff_all on public.customer_preferences for all to authenticated using (exists (select 1 from public.customers c where c.id = customer_id and c.organization_id in (select public.current_staff_org_ids()))) with check (exists (select 1 from public.customers c where c.id = customer_id and c.organization_id in (select public.current_staff_org_ids())));
create policy reservations_staff_all on public.reservations for all to authenticated using (organization_id in (select public.current_staff_org_ids())) with check (organization_id in (select public.current_staff_org_ids()));
create policy assignments_staff_all on public.reservation_table_assignments for all to authenticated using (exists (select 1 from public.reservations r where r.id = reservation_id and r.organization_id in (select public.current_staff_org_ids()))) with check (exists (select 1 from public.reservations r where r.id = reservation_id and r.organization_id in (select public.current_staff_org_ids())));
create policy notes_staff_all on public.reservation_notes for all to authenticated using (exists (select 1 from public.reservations r where r.id = reservation_id and r.organization_id in (select public.current_staff_org_ids()))) with check (exists (select 1 from public.reservations r where r.id = reservation_id and r.organization_id in (select public.current_staff_org_ids())));
create policy events_staff_select on public.reservation_events for select to authenticated using (exists (select 1 from public.reservations r where r.id = reservation_id and r.organization_id in (select public.current_staff_org_ids())));
create policy holds_staff_all on public.reservation_holds for all to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id));
create policy waitlist_staff_all on public.waitlist_entries for all to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id));
create policy staff_users_same_org on public.staff_users for select to authenticated using (organization_id in (select public.current_staff_org_ids()));
create policy roles_read on public.roles for select to authenticated using (true);
create policy staff_roles_same_org on public.staff_user_roles for select to authenticated using (exists (select 1 from public.staff_users s where s.id = staff_user_id and s.organization_id in (select public.current_staff_org_ids())));
create policy calls_staff_all on public.voice_calls for all to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id));
create policy notifications_staff_all on public.notifications for all to authenticated using (organization_id in (select public.current_staff_org_ids())) with check (organization_id in (select public.current_staff_org_ids()));
create policy knowledge_public_read on public.knowledge_base for select to anon, authenticated using (is_public and is_active);
create policy knowledge_staff_all on public.knowledge_base for all to authenticated using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.organization_id in (select public.current_staff_org_ids()))) with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.organization_id in (select public.current_staff_org_ids())));
create policy audit_staff_select on public.audit_logs for select to authenticated using (organization_id in (select public.current_staff_org_ids()));

create or replace function public.assert_reservation_transition()
returns trigger language plpgsql as $$
declare allowed boolean := false;
begin
  if new.status = old.status then return new; end if;
  allowed := case old.status
    when 'draft' then new.status in ('held','pending_approval')
    when 'held' then new.status in ('confirmed','expired')
    when 'pending_confirmation' then new.status in ('confirmed','cancelled_by_customer','expired')
    when 'pending_approval' then new.status in ('confirmed','cancelled_by_restaurant')
    when 'confirmed' then new.status in ('modified','arriving','late','arrived','cancelled_by_customer','cancelled_by_restaurant')
    when 'modified' then new.status in ('arriving','late','arrived','cancelled_by_customer','cancelled_by_restaurant')
    when 'arriving' then new.status in ('arrived','late','cancelled_by_customer','cancelled_by_restaurant')
    when 'late' then new.status in ('arrived','no_show','cancelled_by_restaurant')
    when 'arrived' then new.status in ('seated','cancelled_by_restaurant')
    when 'seated' then new.status = 'completed'
    when 'waitlisted' then new.status in ('offered','cancelled_by_customer')
    when 'offered' then new.status in ('confirmed','expired')
    else false end;
  if not allowed then raise exception 'INVALID_RESERVATION_STATE:%->%', old.status, new.status using errcode = 'check_violation'; end if;
  return new;
end; $$;
create trigger reservations_state_guard before update of status on public.reservations for each row execute function public.assert_reservation_transition();

create or replace function public.sync_assignment_activity()
returns trigger language plpgsql as $$
begin
  if new.status in ('cancelled_by_customer','cancelled_by_restaurant','no_show','expired') then
    update public.reservation_table_assignments set is_active = false where reservation_id = new.id;
  elsif old.status in ('cancelled_by_customer','cancelled_by_restaurant','no_show','expired') and new.status not in ('cancelled_by_customer','cancelled_by_restaurant','no_show','expired') then
    update public.reservation_table_assignments set is_active = true where reservation_id = new.id;
  end if;
  return new;
end; $$;
create trigger reservations_assignment_activity after update of status on public.reservations for each row execute function public.sync_assignment_activity();

create or replace function public.confirm_reservation_from_hold(
  p_hold_id uuid,
  p_idempotency_key text,
  p_management_token_hash text,
  p_customer jsonb,
  p_customer_notes text default null,
  p_special_occasion text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hold public.reservation_holds%rowtype;
  v_location public.locations%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_customer_id uuid;
  v_reservation_id uuid;
  v_service_id uuid;
  v_table_id uuid;
  v_existing jsonb;
  v_normalized_phone text;
  v_normalized_email text;
  v_service public.service_periods%rowtype;
  v_reserved_covers bigint;
  v_arrivals bigint;
begin
  select response_data into v_existing from public.idempotency_keys where key = p_idempotency_key and scope = 'confirm_reservation' and expires_at > now();
  if v_existing is not null then return (v_existing->>'reservation_id')::uuid; end if;

  select * into v_hold from public.reservation_holds where id = p_hold_id for update;
  if not found or v_hold.status <> 'active' or v_hold.expires_at <= now() then raise exception 'HOLD_EXPIRED'; end if;
  select * into v_location from public.locations where id = v_hold.location_id and booking_enabled and status = 'active';
  if not found then raise exception 'LOCATION_UNAVAILABLE'; end if;
  select * into v_restaurant from public.restaurants where id = v_location.restaurant_id and status = 'active';
  if not found then raise exception 'RESTAURANT_UNAVAILABLE'; end if;

  foreach v_table_id in array (select array_agg(x order by x::text) from unnest(v_hold.table_ids) x) loop
    perform pg_advisory_xact_lock(hashtextextended(v_table_id::text, 0));
  end loop;
  if exists (
    select 1 from public.reservation_table_assignments a
    where a.table_id = any(v_hold.table_ids) and a.is_active
      and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(v_hold.start_at, v_hold.end_at, '[)')
  ) then raise exception 'SLOT_UNAVAILABLE'; end if;

  select * into v_service from public.service_periods
  where location_id = v_hold.location_id and is_active
    and day_of_week = extract(dow from v_hold.start_at at time zone v_location.timezone)
    and (v_hold.start_at at time zone v_location.timezone)::time >= start_time
    and (v_hold.start_at at time zone v_location.timezone)::time < end_time
  order by start_time limit 1;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
  v_service_id := v_service.id;
  perform pg_advisory_xact_lock(hashtextextended('service:' || v_hold.location_id::text || ':' || v_hold.start_at::text, 0));
  select
    coalesce((select sum(r.party_size) from public.reservations r where r.location_id = v_hold.location_id and r.status in ('confirmed','modified','arriving','late','arrived','seated') and tstzrange(r.start_at,r.end_at,'[)') && tstzrange(v_hold.start_at,v_hold.end_at,'[)')),0)
    + coalesce((select sum(h.party_size) from public.reservation_holds h where h.location_id = v_hold.location_id and h.status = 'active' and h.expires_at > now() and h.id <> v_hold.id and tstzrange(h.start_at,h.end_at,'[)') && tstzrange(v_hold.start_at,v_hold.end_at,'[)')),0)
  into v_reserved_covers;
  if v_reserved_covers + v_hold.party_size > v_service.maximum_covers then raise exception 'CAPACITY_EXCEEDED'; end if;
  select
    (select count(*) from public.reservations r where r.location_id = v_hold.location_id and r.status in ('confirmed','modified','arriving','late','arrived','seated') and r.start_at = v_hold.start_at)
    + (select count(*) from public.reservation_holds h where h.location_id = v_hold.location_id and h.status = 'active' and h.expires_at > now() and h.id <> v_hold.id and h.start_at = v_hold.start_at)
  into v_arrivals;
  if v_arrivals + 1 > v_service.maximum_arrivals_per_slot then raise exception 'ARRIVAL_LIMIT_EXCEEDED'; end if;

  v_normalized_phone := regexp_replace(coalesce(p_customer->>'phone',''), '[^0-9+]', '', 'g');
  v_normalized_email := nullif(lower(trim(p_customer->>'email')), '');
  perform pg_advisory_xact_lock(hashtextextended('customer:' || coalesce(v_normalized_phone,v_normalized_email,''), 0));
  select id into v_customer_id from public.customers where organization_id = v_restaurant.organization_id and (normalized_phone = v_normalized_phone or (v_normalized_email is not null and normalized_email = v_normalized_email)) and deleted_at is null limit 1 for update;
  if v_customer_id is null then
    insert into public.customers (organization_id, first_name, last_name, phone, normalized_phone, email, normalized_email, preferred_language, marketing_consent, marketing_consent_at, privacy_consent, privacy_consent_at, allergies, accessibility_needs, total_bookings)
    values (v_restaurant.organization_id, p_customer->>'firstName', p_customer->>'lastName', p_customer->>'phone', v_normalized_phone, nullif(p_customer->>'email',''), v_normalized_email, coalesce(p_customer->>'preferredLanguage','it'), coalesce((p_customer->>'marketingConsent')::boolean,false), case when coalesce((p_customer->>'marketingConsent')::boolean,false) then now() end, true, now(), nullif(p_customer->>'allergies',''), nullif(p_customer->>'accessibilityNeeds',''), 1)
    returning id into v_customer_id;
  else
    update public.customers set
      first_name = p_customer->>'firstName',
      last_name = p_customer->>'lastName',
      phone = p_customer->>'phone',
      normalized_phone = v_normalized_phone,
      email = coalesce(nullif(p_customer->>'email',''), email),
      normalized_email = coalesce(v_normalized_email, normalized_email),
      preferred_language = coalesce(p_customer->>'preferredLanguage', preferred_language),
      privacy_consent = true,
      privacy_consent_at = coalesce(privacy_consent_at, now()),
      marketing_consent = marketing_consent or coalesce((p_customer->>'marketingConsent')::boolean,false),
      marketing_consent_at = case when marketing_consent or coalesce((p_customer->>'marketingConsent')::boolean,false) then coalesce(marketing_consent_at,now()) end,
      allergies = coalesce(nullif(p_customer->>'allergies',''), allergies),
      accessibility_needs = coalesce(nullif(p_customer->>'accessibilityNeeds',''), accessibility_needs),
      customer_type = case
        when customer_type in ('vip','corporate','inactive','no_show_risk') then customer_type
        when total_bookings + 1 >= 10 then 'loyal'
        when total_bookings + 1 >= 2 then 'regular'
        else customer_type
      end,
      total_bookings = total_bookings + 1,
      updated_at = now()
    where id = v_customer_id;
  end if;

  insert into public.reservations (organization_id, restaurant_id, location_id, customer_id, service_period_id, reservation_code, management_token_hash, source, status, party_size, reservation_date, start_at, end_at, duration_minutes, dining_area_preference_id, assigned_combination_id, customer_notes, special_occasion, language, confirmed_at)
  values (v_restaurant.organization_id, v_restaurant.id, v_location.id, v_customer_id, v_service_id, 'MG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)), p_management_token_hash, v_hold.source, 'confirmed', v_hold.party_size, (v_hold.start_at at time zone v_location.timezone)::date, v_hold.start_at, v_hold.end_at, greatest(30, extract(epoch from (v_hold.end_at - v_hold.start_at))::integer / 60 - 15), v_hold.dining_area_id, v_hold.combination_id, p_customer_notes, p_special_occasion, coalesce(p_customer->>'preferredLanguage','it'), now())
  returning id into v_reservation_id;

  insert into public.reservation_table_assignments (reservation_id, table_id, start_at, end_at)
  select v_reservation_id, unnest(v_hold.table_ids), v_hold.start_at, v_hold.end_at;
  update public.reservation_holds set status = 'converted' where id = v_hold.id;
  insert into public.reservation_events (reservation_id, event_type, new_data, source, actor_type) values (v_reservation_id, 'reservation_confirmed', jsonb_build_object('hold_id', v_hold.id), v_hold.source, case when v_hold.source = 'phone_ai' then 'voice' else 'customer' end);
  insert into public.idempotency_keys (key, scope, response_data) values (p_idempotency_key, 'confirm_reservation', jsonb_build_object('reservation_id', v_reservation_id));
  return v_reservation_id;
exception when exclusion_violation then
  raise exception 'SLOT_UNAVAILABLE';
end; $$;

revoke all on function public.confirm_reservation_from_hold(uuid,text,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.confirm_reservation_from_hold(uuid,text,text,jsonb,text,text) to service_role;

create or replace function public.expire_reservation_holds()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare affected integer;
begin
  update public.reservation_holds set status = 'expired' where status = 'active' and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end; $$;
revoke all on function public.expire_reservation_holds() from public, anon, authenticated;
grant execute on function public.expire_reservation_holds() to service_role;
