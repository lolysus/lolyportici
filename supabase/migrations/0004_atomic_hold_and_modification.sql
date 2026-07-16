create or replace function public.create_reservation_hold(
  p_location_id uuid,
  p_session_id text,
  p_source text,
  p_party_size integer,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_table_ids uuid[],
  p_combination_id uuid default null,
  p_dining_area_id uuid default null,
  p_expires_at timestamptz default (now() + interval '5 minutes')
) returns public.reservation_holds
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_location public.locations%rowtype;
  v_service public.service_periods%rowtype;
  v_rule public.booking_rules%rowtype;
  v_hold public.reservation_holds%rowtype;
  v_table_id uuid;
  v_reserved_covers bigint;
  v_arrivals bigint;
  v_combination_tables uuid[];
begin
  if p_party_size < 1 or p_party_size > 10 or p_end_at <= p_start_at or cardinality(p_table_ids) < 1 then
    raise exception 'INVALID_HOLD_INPUT';
  end if;
  select * into v_location from public.locations
  where id = p_location_id and booking_enabled and status = 'active';
  if not found then raise exception 'LOCATION_UNAVAILABLE'; end if;
  if not exists (select 1 from public.restaurants r where r.id = v_location.restaurant_id and r.status = 'active') then
    raise exception 'RESTAURANT_UNAVAILABLE';
  end if;
  select * into v_service from public.service_periods
  where location_id = p_location_id and is_active
    and day_of_week = extract(dow from p_start_at at time zone v_location.timezone)
    and (p_start_at at time zone v_location.timezone)::time >= start_time
    and (p_start_at at time zone v_location.timezone)::time < end_time
    and case when p_source = 'phone_ai' then phone_booking_enabled else online_booking_enabled end
  order by start_time limit 1;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
  select * into v_rule from public.booking_rules
  where location_id = p_location_id and is_active and (channel is null or channel = p_source)
    and (service_period_id is null or service_period_id = v_service.id)
    and (dining_area_id is null or dining_area_id = p_dining_area_id)
  order by (channel = p_source) desc nulls last, service_period_id nulls last, dining_area_id nulls last
  limit 1;
  if not found then raise exception 'BOOKING_RULE_UNAVAILABLE'; end if;
  if p_party_size < v_rule.minimum_party_size or p_party_size > v_rule.maximum_party_size or v_rule.requires_manual_approval then
    raise exception 'MANUAL_APPROVAL_REQUIRED';
  end if;
  if p_start_at < now() + make_interval(mins => v_rule.minimum_notice_minutes)
    or (p_start_at at time zone v_location.timezone)::date > (now() at time zone v_location.timezone)::date + v_rule.maximum_advance_days then
    raise exception 'BOOKING_WINDOW_VIOLATION';
  end if;
  if exists (
    select 1 from public.special_openings_closures c
    where c.location_id = p_location_id and c.type <> 'opening'
      and c.date = (p_start_at at time zone v_location.timezone)::date
      and (c.start_time is null or (p_start_at at time zone v_location.timezone)::time >= c.start_time and (p_start_at at time zone v_location.timezone)::time < c.end_time)
      and (c.type = 'full_closure' or (c.affected_area_id is null and c.affected_table_id is null) or c.affected_area_id = p_dining_area_id or c.affected_table_id = any(p_table_ids))
  ) then raise exception 'LOCATION_CLOSED'; end if;

  foreach v_table_id in array (select array_agg(x order by x::text) from unnest(p_table_ids) x) loop
    perform pg_advisory_xact_lock(hashtextextended(v_table_id::text, 0));
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('service:' || p_location_id::text || ':' || p_start_at::text, 0));

  if (select count(*) from public.restaurant_tables t where t.id = any(p_table_ids) and t.location_id = p_location_id and t.is_active and t.status not in ('blocked','out_of_service')) <> cardinality(p_table_ids) then
    raise exception 'TABLE_UNAVAILABLE';
  end if;
  if p_combination_id is null then
    if cardinality(p_table_ids) <> 1 or not exists (
      select 1 from public.restaurant_tables t where t.id = p_table_ids[1]
        and p_party_size between t.minimum_capacity and t.maximum_capacity
    ) then raise exception 'TABLE_CAPACITY_MISMATCH'; end if;
  else
    select array_agg(i.table_id order by i.table_id::text) into v_combination_tables
    from public.table_combination_items i where i.table_combination_id = p_combination_id;
    if not exists (
      select 1 from public.table_combinations c where c.id = p_combination_id
        and c.location_id = p_location_id and c.is_active
        and p_party_size between c.minimum_capacity and c.maximum_capacity
    ) or not (v_combination_tables <@ p_table_ids and p_table_ids <@ v_combination_tables) then
      raise exception 'TABLE_CAPACITY_MISMATCH';
    end if;
  end if;
  if exists (
    select 1 from public.reservation_table_assignments a
    where a.table_id = any(p_table_ids) and a.is_active
      and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')
  ) or exists (
    select 1 from public.reservation_holds h
    where h.location_id = p_location_id and h.status = 'active' and h.expires_at > now()
      and h.table_ids && p_table_ids
      and tstzrange(h.start_at,h.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')
  ) then raise exception 'SLOT_UNAVAILABLE'; end if;

  select
    coalesce((select sum(r.party_size) from public.reservations r where r.location_id = p_location_id and r.status in ('confirmed','modified','arriving','late','arrived','seated') and tstzrange(r.start_at,r.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')),0)
    + coalesce((select sum(h.party_size) from public.reservation_holds h where h.location_id = p_location_id and h.status = 'active' and h.expires_at > now() and tstzrange(h.start_at,h.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')),0)
  into v_reserved_covers;
  if v_reserved_covers + p_party_size > v_service.maximum_covers then raise exception 'CAPACITY_EXCEEDED'; end if;
  select
    (select count(*) from public.reservations r where r.location_id = p_location_id and r.status in ('confirmed','modified','arriving','late','arrived','seated') and r.start_at = p_start_at)
    + (select count(*) from public.reservation_holds h where h.location_id = p_location_id and h.status = 'active' and h.expires_at > now() and h.start_at = p_start_at)
  into v_arrivals;
  if v_arrivals + 1 > v_service.maximum_arrivals_per_slot then raise exception 'ARRIVAL_LIMIT_EXCEEDED'; end if;

  insert into public.reservation_holds (
    location_id,session_id,source,party_size,start_at,end_at,table_ids,
    combination_id,dining_area_id,expires_at,status
  ) values (
    p_location_id,p_session_id,p_source,p_party_size,p_start_at,p_end_at,p_table_ids,
    p_combination_id,p_dining_area_id,p_expires_at,'active'
  ) returning * into v_hold;
  return v_hold;
end; $$;

revoke all on function public.create_reservation_hold(uuid,text,text,integer,timestamptz,timestamptz,uuid[],uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.create_reservation_hold(uuid,text,text,integer,timestamptz,timestamptz,uuid[],uuid,uuid,timestamptz) to service_role;

create or replace function public.modify_reservation_from_token(
  p_management_token_hash text,
  p_party_size integer,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_duration_minutes integer,
  p_table_ids uuid[],
  p_combination_id uuid,
  p_dining_area_id uuid,
  p_customer_notes text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_reservation public.reservations%rowtype;
  v_location public.locations%rowtype;
  v_service public.service_periods%rowtype;
  v_rule public.booking_rules%rowtype;
  v_table_id uuid;
  v_reserved_covers bigint;
  v_arrivals bigint;
  v_combination_tables uuid[];
begin
  select * into v_reservation from public.reservations
  where management_token_hash = p_management_token_hash and deleted_at is null for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if v_reservation.status not in ('confirmed','modified') then raise exception 'MODIFICATION_NOT_ALLOWED'; end if;
  if p_party_size < 1 or p_party_size > 10 or p_end_at <= p_start_at or cardinality(p_table_ids) < 1 then raise exception 'INVALID_MODIFICATION'; end if;
  select * into v_location from public.locations where id = v_reservation.location_id;
  select * into v_service from public.service_periods
  where location_id = v_reservation.location_id and is_active
    and day_of_week = extract(dow from p_start_at at time zone v_location.timezone)
    and (p_start_at at time zone v_location.timezone)::time >= start_time
    and (p_start_at at time zone v_location.timezone)::time < end_time
    and online_booking_enabled
  order by start_time limit 1;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
  select * into v_rule from public.booking_rules
  where location_id = v_reservation.location_id and is_active and (channel is null or channel = 'web')
    and (service_period_id is null or service_period_id = v_service.id)
    and (dining_area_id is null or dining_area_id = p_dining_area_id)
  order by (channel = 'web') desc nulls last, service_period_id nulls last, dining_area_id nulls last
  limit 1;
  if not found then raise exception 'BOOKING_RULE_UNAVAILABLE'; end if;
  if p_party_size < v_rule.minimum_party_size or p_party_size > v_rule.maximum_party_size or v_rule.requires_manual_approval then
    raise exception 'MANUAL_APPROVAL_REQUIRED';
  end if;
  if p_start_at < now() + make_interval(mins => v_rule.minimum_notice_minutes)
    or (p_start_at at time zone v_location.timezone)::date > (now() at time zone v_location.timezone)::date + v_rule.maximum_advance_days then
    raise exception 'BOOKING_WINDOW_VIOLATION';
  end if;
  if exists (
    select 1 from public.special_openings_closures c
    where c.location_id = v_reservation.location_id and c.type <> 'opening'
      and c.date = (p_start_at at time zone v_location.timezone)::date
      and (c.start_time is null or (p_start_at at time zone v_location.timezone)::time >= c.start_time and (p_start_at at time zone v_location.timezone)::time < c.end_time)
      and (c.type = 'full_closure' or (c.affected_area_id is null and c.affected_table_id is null) or c.affected_area_id = p_dining_area_id or c.affected_table_id = any(p_table_ids))
  ) then raise exception 'LOCATION_CLOSED'; end if;

  foreach v_table_id in array (select array_agg(x order by x::text) from unnest(p_table_ids) x) loop
    perform pg_advisory_xact_lock(hashtextextended(v_table_id::text, 0));
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('service:' || v_reservation.location_id::text || ':' || p_start_at::text, 0));
  if (select count(*) from public.restaurant_tables t where t.id = any(p_table_ids) and t.location_id = v_reservation.location_id and t.is_active and t.status not in ('blocked','out_of_service')) <> cardinality(p_table_ids) then
    raise exception 'TABLE_UNAVAILABLE';
  end if;
  if p_combination_id is null then
    if cardinality(p_table_ids) <> 1 or not exists (
      select 1 from public.restaurant_tables t where t.id = p_table_ids[1]
        and p_party_size between t.minimum_capacity and t.maximum_capacity
    ) then raise exception 'TABLE_CAPACITY_MISMATCH'; end if;
  else
    select array_agg(i.table_id order by i.table_id::text) into v_combination_tables
    from public.table_combination_items i where i.table_combination_id = p_combination_id;
    if not exists (
      select 1 from public.table_combinations c where c.id = p_combination_id
        and c.location_id = v_reservation.location_id and c.is_active
        and p_party_size between c.minimum_capacity and c.maximum_capacity
    ) or not (v_combination_tables <@ p_table_ids and p_table_ids <@ v_combination_tables) then
      raise exception 'TABLE_CAPACITY_MISMATCH';
    end if;
  end if;
  if exists (
    select 1 from public.reservation_table_assignments a
    where a.reservation_id <> v_reservation.id and a.table_id = any(p_table_ids) and a.is_active
      and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')
  ) or exists (
    select 1 from public.reservation_holds h where h.location_id = v_reservation.location_id
      and h.status = 'active' and h.expires_at > now() and h.table_ids && p_table_ids
      and tstzrange(h.start_at,h.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')
  ) then raise exception 'SLOT_UNAVAILABLE'; end if;

  select
    coalesce((select sum(r.party_size) from public.reservations r where r.id <> v_reservation.id and r.location_id = v_reservation.location_id and r.status in ('confirmed','modified','arriving','late','arrived','seated') and tstzrange(r.start_at,r.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')),0)
    + coalesce((select sum(h.party_size) from public.reservation_holds h where h.location_id = v_reservation.location_id and h.status = 'active' and h.expires_at > now() and tstzrange(h.start_at,h.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')),0)
  into v_reserved_covers;
  if v_reserved_covers + p_party_size > v_service.maximum_covers then raise exception 'CAPACITY_EXCEEDED'; end if;
  select
    (select count(*) from public.reservations r where r.id <> v_reservation.id and r.location_id = v_reservation.location_id and r.status in ('confirmed','modified','arriving','late','arrived','seated') and r.start_at = p_start_at)
    + (select count(*) from public.reservation_holds h where h.location_id = v_reservation.location_id and h.status = 'active' and h.expires_at > now() and h.start_at = p_start_at)
  into v_arrivals;
  if v_arrivals + 1 > v_service.maximum_arrivals_per_slot then raise exception 'ARRIVAL_LIMIT_EXCEEDED'; end if;

  delete from public.reservation_table_assignments where reservation_id = v_reservation.id;
  insert into public.reservation_table_assignments (reservation_id,table_id,start_at,end_at)
  select v_reservation.id, unnest(p_table_ids), p_start_at, p_end_at;
  update public.reservations set
    service_period_id = v_service.id,
    status = 'modified',
    party_size = p_party_size,
    reservation_date = (p_start_at at time zone v_location.timezone)::date,
    start_at = p_start_at,
    end_at = p_end_at,
    duration_minutes = p_duration_minutes,
    dining_area_preference_id = p_dining_area_id,
    assigned_table_id = case when cardinality(p_table_ids) = 1 then p_table_ids[1] else null end,
    assigned_combination_id = p_combination_id,
    customer_notes = p_customer_notes,
    updated_at = now()
  where id = v_reservation.id;
  insert into public.reservation_events (reservation_id,event_type,previous_data,new_data,source,actor_type)
  values (v_reservation.id,'reservation_modified',to_jsonb(v_reservation),jsonb_build_object('party_size',p_party_size,'start_at',p_start_at,'table_ids',p_table_ids),'web','customer');
  return v_reservation.id;
end; $$;

revoke all on function public.modify_reservation_from_token(text,integer,timestamptz,timestamptz,integer,uuid[],uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.modify_reservation_from_token(text,integer,timestamptz,timestamptz,integer,uuid[],uuid,uuid,text) to service_role;

create or replace function public.reassign_reservation_tables(
  p_reservation_id uuid,
  p_table_ids uuid[],
  p_status text default null,
  p_customer_notes text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_reservation public.reservations%rowtype;
  v_table_id uuid;
  v_capacity integer;
  v_previous_table_ids uuid[];
begin
  select * into v_reservation from public.reservations where id = p_reservation_id and deleted_at is null for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if cardinality(p_table_ids) < 1 then raise exception 'TABLE_UNAVAILABLE'; end if;
  foreach v_table_id in array (select array_agg(x order by x::text) from unnest(p_table_ids) x) loop
    perform pg_advisory_xact_lock(hashtextextended(v_table_id::text, 0));
  end loop;
  if (select count(*) from public.restaurant_tables t where t.id = any(p_table_ids) and t.location_id = v_reservation.location_id and t.is_active and t.status not in ('blocked','out_of_service')) <> cardinality(p_table_ids) then
    raise exception 'TABLE_UNAVAILABLE';
  end if;
  select sum(t.maximum_capacity) into v_capacity from public.restaurant_tables t where t.id = any(p_table_ids);
  if v_capacity < v_reservation.party_size then raise exception 'TABLE_CAPACITY_MISMATCH'; end if;
  if exists (
    select 1 from public.reservation_table_assignments a
    where a.reservation_id <> v_reservation.id and a.table_id = any(p_table_ids) and a.is_active
      and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(v_reservation.start_at,v_reservation.end_at,'[)')
  ) or exists (
    select 1 from public.reservation_holds h where h.location_id = v_reservation.location_id
      and h.status = 'active' and h.expires_at > now() and h.table_ids && p_table_ids
      and tstzrange(h.start_at,h.end_at,'[)') && tstzrange(v_reservation.start_at,v_reservation.end_at,'[)')
  ) then raise exception 'TABLE_CONFLICT'; end if;
  select array_agg(table_id order by table_id::text) into v_previous_table_ids
  from public.reservation_table_assignments where reservation_id = v_reservation.id;
  delete from public.reservation_table_assignments where reservation_id = v_reservation.id;
  insert into public.reservation_table_assignments (reservation_id,table_id,start_at,end_at)
  select v_reservation.id, unnest(p_table_ids), v_reservation.start_at, v_reservation.end_at;
  update public.reservations set
    assigned_table_id = case when cardinality(p_table_ids) = 1 then p_table_ids[1] else null end,
    assigned_combination_id = null,
    status = coalesce(p_status,status),
    customer_notes = coalesce(p_customer_notes,customer_notes),
    updated_at = now()
  where id = v_reservation.id;
  insert into public.reservation_events (reservation_id,event_type,previous_data,new_data,source,actor_type)
  values (v_reservation.id,'tables_reassigned',jsonb_build_object('table_ids',v_previous_table_ids),jsonb_build_object('table_ids',p_table_ids),'admin','staff');
  return v_reservation.id;
end; $$;

revoke all on function public.reassign_reservation_tables(uuid,uuid[],text,text) from public, anon, authenticated;
grant execute on function public.reassign_reservation_tables(uuid,uuid[],text,text) to service_role;

create or replace function public.update_reservation_by_staff(
  p_reservation_id uuid,
  p_status text default null,
  p_customer_notes text default null,
  p_update_notes boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_reservation public.reservations%rowtype;
begin
  select * into v_reservation from public.reservations
  where id = p_reservation_id and deleted_at is null for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  update public.reservations set
    status = coalesce(p_status,status),
    customer_notes = case when p_update_notes then p_customer_notes else customer_notes end,
    updated_at = now()
  where id = p_reservation_id;
  insert into public.reservation_events (reservation_id,event_type,previous_data,new_data,source,actor_type)
  values (
    p_reservation_id,
    case when p_status is not null and p_status <> v_reservation.status then 'status_changed' else 'reservation_notes_updated' end,
    jsonb_build_object('status',v_reservation.status,'customer_notes',v_reservation.customer_notes),
    jsonb_build_object('status',coalesce(p_status,v_reservation.status),'customer_notes',case when p_update_notes then p_customer_notes else v_reservation.customer_notes end),
    'admin','staff'
  );
  return p_reservation_id;
end; $$;

revoke all on function public.update_reservation_by_staff(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.update_reservation_by_staff(uuid,text,text,boolean) to service_role;
