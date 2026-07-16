-- Keep the hard safety boundary in the atomic RPCs aligned with the limit
-- exposed by the administrator. The active booking rule remains the actual
-- per-service, per-channel limit.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.create_reservation_hold(uuid,text,text,integer,timestamptz,timestamptz,uuid[],uuid,uuid,timestamptz)'::regprocedure
  ) into v_definition;
  if position('p_party_size > 10' in v_definition) > 0 then
    execute replace(v_definition, 'p_party_size > 10', 'p_party_size > 100');
  end if;

  select pg_get_functiondef(
    'public.modify_reservation_from_token(text,integer,timestamptz,timestamptz,integer,uuid[],uuid,uuid,text)'::regprocedure
  ) into v_definition;
  if position('p_party_size > 10' in v_definition) > 0 then
    execute replace(v_definition, 'p_party_size > 10', 'p_party_size > 100');
  end if;
end $$;

-- Reconcile late and no-show states against the active location policy. This
-- is called by the protected scheduled endpoint and can also be called when
-- the operational dashboard opens, so the service never waits on a browser
-- cache to reflect the configured thresholds.
create or replace function public.reconcile_reservation_statuses(
  p_location_id uuid
) returns table(marked_late integer, marked_no_show integer)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  with candidates as (
    select r.id, r.status
    from public.reservations r
    cross join lateral (
      select br.late_tolerance_minutes
      from public.booking_rules br
      where br.location_id = r.location_id and br.is_active
      order by br.created_at
      limit 1
    ) rule
    where r.location_id = p_location_id
      and r.status in ('confirmed', 'modified', 'arriving')
      and r.start_at + make_interval(mins => rule.late_tolerance_minutes) <= now()
    for update of r skip locked
  ), transitioned as (
    update public.reservations r
    set status = 'late', updated_at = now()
    from candidates c
    where r.id = c.id
    returning r.id, c.status as previous_status
  ), logged as (
    insert into public.reservation_events (reservation_id, event_type, previous_data, new_data, source, actor_type, metadata)
    select id, 'reservation_late', jsonb_build_object('status', previous_status), jsonb_build_object('status', 'late'), 'system', 'system', jsonb_build_object('policy', 'late_tolerance')
    from transitioned
    returning reservation_id
  )
  select count(*)::integer into marked_late from transitioned;

  with candidates as (
    select r.id, r.customer_id
    from public.reservations r
    cross join lateral (
      select br.no_show_after_minutes
      from public.booking_rules br
      where br.location_id = r.location_id and br.is_active
      order by br.created_at
      limit 1
    ) rule
    where r.location_id = p_location_id
      and r.status = 'late'
      and r.start_at + make_interval(mins => rule.no_show_after_minutes) <= now()
    for update of r skip locked
  ), transitioned as (
    update public.reservations r
    set status = 'no_show', no_show_at = now(), updated_at = now()
    from candidates c
    where r.id = c.id
    returning r.id, c.customer_id
  ), customer_counts as (
    select customer_id, count(*)::integer as occurrences
    from transitioned
    where customer_id is not null
    group by customer_id
  ), updated_customers as (
    update public.customers c
    set no_show_count = c.no_show_count + customer_counts.occurrences
    from customer_counts
    where c.id = customer_counts.customer_id
    returning c.id
  ), logged as (
    insert into public.reservation_events (reservation_id, event_type, previous_data, new_data, source, actor_type, metadata)
    select id, 'reservation_no_show', jsonb_build_object('status', 'late'), jsonb_build_object('status', 'no_show'), 'system', 'system', jsonb_build_object('policy', 'no_show_after')
    from transitioned
    returning reservation_id
  )
  select count(*)::integer into marked_no_show from transitioned;

  return next;
end; $$;

revoke all on function public.reconcile_reservation_statuses(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_reservation_statuses(uuid) to service_role;
