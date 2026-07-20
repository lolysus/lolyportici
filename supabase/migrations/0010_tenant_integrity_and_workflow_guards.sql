-- The application scopes every booking operation by location. These guards make
-- the same boundary non-bypassable for service-role jobs, imports and future
-- integrations that write directly to Postgres.

create or replace function public.assert_reservation_tenant_integrity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_restaurant_id uuid;
begin
  select restaurant.organization_id, location.restaurant_id
    into v_organization_id, v_restaurant_id
  from public.locations location
  join public.restaurants restaurant on restaurant.id = location.restaurant_id
  where location.id = new.location_id;

  if not found then
    raise exception 'RESERVATION_LOCATION_NOT_FOUND';
  end if;
  if new.organization_id <> v_organization_id or new.restaurant_id <> v_restaurant_id then
    raise exception 'RESERVATION_TENANT_MISMATCH';
  end if;
  if not exists (
    select 1 from public.customers customer
    where customer.id = new.customer_id and customer.organization_id = v_organization_id
  ) then
    raise exception 'RESERVATION_CUSTOMER_TENANT_MISMATCH';
  end if;
  if not exists (
    select 1 from public.service_periods service
    where service.id = new.service_period_id and service.location_id = new.location_id
  ) then
    raise exception 'RESERVATION_SERVICE_LOCATION_MISMATCH';
  end if;
  if new.dining_area_preference_id is not null and not exists (
    select 1 from public.dining_areas area
    where area.id = new.dining_area_preference_id and area.location_id = new.location_id
  ) then
    raise exception 'RESERVATION_AREA_LOCATION_MISMATCH';
  end if;
  if new.assigned_table_id is not null and not exists (
    select 1 from public.restaurant_tables restaurant_table
    where restaurant_table.id = new.assigned_table_id and restaurant_table.location_id = new.location_id
  ) then
    raise exception 'RESERVATION_TABLE_LOCATION_MISMATCH';
  end if;
  if new.assigned_combination_id is not null and not exists (
    select 1 from public.table_combinations combination
    where combination.id = new.assigned_combination_id and combination.location_id = new.location_id
  ) then
    raise exception 'RESERVATION_COMBINATION_LOCATION_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_tenant_integrity_guard on public.reservations;
create trigger reservations_tenant_integrity_guard
before insert or update on public.reservations
for each row execute function public.assert_reservation_tenant_integrity();

create or replace function public.assert_reservation_assignment_tenant_integrity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_location_id uuid;
begin
  select location_id into v_location_id
  from public.reservations
  where id = new.reservation_id;

  if not found then
    raise exception 'ASSIGNMENT_RESERVATION_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.restaurant_tables restaurant_table
    where restaurant_table.id = new.table_id and restaurant_table.location_id = v_location_id
  ) then
    raise exception 'ASSIGNMENT_TABLE_LOCATION_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists reservation_assignment_tenant_integrity_guard on public.reservation_table_assignments;
create trigger reservation_assignment_tenant_integrity_guard
before insert or update on public.reservation_table_assignments
for each row execute function public.assert_reservation_assignment_tenant_integrity();

create or replace function public.assert_hold_tenant_integrity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(new.session_id), '') is null then
    raise exception 'HOLD_SESSION_REQUIRED';
  end if;
  if coalesce(cardinality(new.table_ids), 0) < 1 then
    raise exception 'HOLD_TABLE_REQUIRED';
  end if;
  if (
    select count(*)
    from public.restaurant_tables restaurant_table
    where restaurant_table.id = any(new.table_ids)
      and restaurant_table.location_id = new.location_id
  ) <> cardinality(new.table_ids) then
    raise exception 'HOLD_TABLE_LOCATION_MISMATCH';
  end if;
  if new.dining_area_id is not null and not exists (
    select 1 from public.dining_areas area
    where area.id = new.dining_area_id and area.location_id = new.location_id
  ) then
    raise exception 'HOLD_AREA_LOCATION_MISMATCH';
  end if;
  if new.combination_id is not null and not exists (
    select 1 from public.table_combinations combination
    where combination.id = new.combination_id and combination.location_id = new.location_id
  ) then
    raise exception 'HOLD_COMBINATION_LOCATION_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists reservation_hold_tenant_integrity_guard on public.reservation_holds;
create trigger reservation_hold_tenant_integrity_guard
before insert or update on public.reservation_holds
for each row execute function public.assert_hold_tenant_integrity();

create or replace function public.assert_waitlist_tenant_integrity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_timezone text;
begin
  select restaurant.organization_id, location.timezone
    into v_organization_id, v_timezone
  from public.locations location
  join public.restaurants restaurant on restaurant.id = location.restaurant_id
  where location.id = new.location_id;

  if not found then
    raise exception 'WAITLIST_LOCATION_NOT_FOUND';
  end if;
  if new.customer_id is not null and not exists (
    select 1 from public.customers customer
    where customer.id = new.customer_id and customer.organization_id = v_organization_id
  ) then
    raise exception 'WAITLIST_CUSTOMER_TENANT_MISMATCH';
  end if;
  if new.preferred_area_id is not null and not exists (
    select 1 from public.dining_areas area
    where area.id = new.preferred_area_id and area.location_id = new.location_id
  ) then
    raise exception 'WAITLIST_AREA_LOCATION_MISMATCH';
  end if;
  if new.requested_date <> (new.requested_start_at at time zone v_timezone)::date then
    raise exception 'WAITLIST_DATE_TIMEZONE_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists waitlist_tenant_integrity_guard on public.waitlist_entries;
create trigger waitlist_tenant_integrity_guard
before insert or update on public.waitlist_entries
for each row execute function public.assert_waitlist_tenant_integrity();

create or replace function public.assert_waitlist_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then return new; end if;
  if (old.status = 'waiting' and new.status in ('offered', 'cancelled'))
    or (old.status = 'offered' and new.status in ('converted', 'expired', 'cancelled')) then
    return new;
  end if;
  raise exception 'INVALID_WAITLIST_STATE_TRANSITION: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists waitlist_state_guard on public.waitlist_entries;
create trigger waitlist_state_guard
before update of status on public.waitlist_entries
for each row execute function public.assert_waitlist_transition();

create or replace function public.assert_booking_rule_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.service_period_id is not null and not exists (
    select 1 from public.service_periods service
    where service.id = new.service_period_id and service.location_id = new.location_id
  ) then
    raise exception 'BOOKING_RULE_SERVICE_LOCATION_MISMATCH';
  end if;
  if new.dining_area_id is not null and not exists (
    select 1 from public.dining_areas area
    where area.id = new.dining_area_id and area.location_id = new.location_id
  ) then
    raise exception 'BOOKING_RULE_AREA_LOCATION_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_rule_scope_guard on public.booking_rules;
create trigger booking_rule_scope_guard
before insert or update on public.booking_rules
for each row execute function public.assert_booking_rule_scope();

create or replace function public.assert_closure_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.affected_area_id is not null and not exists (
    select 1 from public.dining_areas area
    where area.id = new.affected_area_id and area.location_id = new.location_id
  ) then
    raise exception 'CLOSURE_AREA_LOCATION_MISMATCH';
  end if;
  if new.affected_table_id is not null and not exists (
    select 1 from public.restaurant_tables restaurant_table
    where restaurant_table.id = new.affected_table_id and restaurant_table.location_id = new.location_id
  ) then
    raise exception 'CLOSURE_TABLE_LOCATION_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists closure_scope_guard on public.special_openings_closures;
create trigger closure_scope_guard
before insert or update on public.special_openings_closures
for each row execute function public.assert_closure_scope();

create index if not exists reservation_holds_location_session_active_idx
  on public.reservation_holds(location_id, session_id, expires_at)
  where status = 'active';

create index if not exists waitlist_entries_customer_date_idx
  on public.waitlist_entries(customer_id, requested_date desc)
  where customer_id is not null;
