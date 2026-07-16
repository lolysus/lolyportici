create index reservations_location_start_idx on public.reservations(location_id, start_at) where deleted_at is null;
create index reservations_customer_idx on public.reservations(customer_id, start_at desc) where deleted_at is null;
create index reservations_status_idx on public.reservations(location_id, status, reservation_date);
create index reservation_events_reservation_idx on public.reservation_events(reservation_id, created_at desc);
create index holds_active_idx on public.reservation_holds(location_id, start_at, expires_at) where status = 'active';
create index waitlist_active_idx on public.waitlist_entries(location_id, requested_date, priority desc, created_at) where status in ('waiting','offered');
create index customers_search_idx on public.customers using gin (to_tsvector('simple', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(email,'')));
create index calls_location_started_idx on public.voice_calls(location_id, started_at desc);
create index notifications_queue_idx on public.notifications(status, scheduled_at) where status in ('queued','failed');
create index audit_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index webhook_status_idx on public.webhook_events(status, created_at) where status <> 'processed';

create or replace function public.audit_reservation_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare row_data public.reservations%rowtype;
begin
  row_data := case when tg_op = 'DELETE' then old else new end;
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, previous_data, new_data)
  values (row_data.organization_id, auth.uid(), lower(tg_op), 'reservation', row_data.id, case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end, case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return case when tg_op = 'DELETE' then old else new end;
end; $$;
create trigger reservations_audit after insert or update or delete on public.reservations for each row execute function public.audit_reservation_mutation();

create or replace view public.daily_location_metrics with (security_invoker = true) as
select
  location_id,
  reservation_date,
  count(*) filter (where status not in ('cancelled_by_customer','cancelled_by_restaurant','expired')) as reservations,
  coalesce(sum(party_size) filter (where status not in ('cancelled_by_customer','cancelled_by_restaurant','expired')), 0) as covers,
  count(*) filter (where status = 'no_show') as no_shows,
  count(*) filter (where source = 'phone_ai') as phone_ai_reservations
from public.reservations
where deleted_at is null
group by location_id, reservation_date;

do $$
begin
  alter publication supabase_realtime add table public.reservations;
  alter publication supabase_realtime add table public.reservation_holds;
  alter publication supabase_realtime add table public.waitlist_entries;
  alter publication supabase_realtime add table public.restaurant_tables;
  alter publication supabase_realtime add table public.customers;
  alter publication supabase_realtime add table public.voice_calls;
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

create or replace function public.prevent_sensitive_customer_note_leak()
returns trigger language plpgsql as $$
begin
  if new.visibility = 'customer' and new.type in ('internal','risk','staff') then
    raise exception 'SENSITIVE_NOTE_CANNOT_BE_CUSTOMER_VISIBLE';
  end if;
  return new;
end; $$;
create trigger reservation_notes_visibility_guard before insert or update on public.reservation_notes for each row execute function public.prevent_sensitive_customer_note_leak();
