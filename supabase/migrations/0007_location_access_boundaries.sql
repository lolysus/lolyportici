-- Enforce branch-level isolation for authenticated staff. The service role used
-- by trusted server handlers still bypasses RLS, so application handlers must
-- also validate the location stored in the staff session.

create or replace function public.current_staff_has_central_access()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.staff_users staff
    join public.staff_user_roles assignment on assignment.staff_user_id = staff.id
    join public.roles role on role.id = assignment.role_id
    where staff.auth_user_id = auth.uid()
      and staff.status = 'active'
      and (assignment.location_id is null or role.name in ('owner', 'administrator'))
  );
$$;

create or replace function public.can_access_location(p_location_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.locations location
    join public.restaurants restaurant on restaurant.id = location.restaurant_id
    join public.staff_users staff on staff.organization_id = restaurant.organization_id
    join public.staff_user_roles assignment on assignment.staff_user_id = staff.id
    join public.roles role on role.id = assignment.role_id
    where location.id = p_location_id
      and staff.auth_user_id = auth.uid()
      and staff.status = 'active'
      and (
        assignment.location_id = p_location_id
        or assignment.location_id is null
        or role.name in ('owner', 'administrator')
      )
  );
$$;

revoke all on function public.current_staff_has_central_access() from public;
revoke all on function public.can_access_location(uuid) from public;
grant execute on function public.current_staff_has_central_access() to authenticated, service_role;
grant execute on function public.can_access_location(uuid) to authenticated, service_role;

drop policy if exists reservations_staff_all on public.reservations;
create policy reservations_staff_all on public.reservations for all to authenticated
using (public.can_access_location(location_id))
with check (public.can_access_location(location_id));

drop policy if exists assignments_staff_all on public.reservation_table_assignments;
create policy assignments_staff_all on public.reservation_table_assignments for all to authenticated
using (exists (select 1 from public.reservations reservation where reservation.id = reservation_id and public.can_access_location(reservation.location_id)))
with check (exists (select 1 from public.reservations reservation where reservation.id = reservation_id and public.can_access_location(reservation.location_id)));

drop policy if exists notes_staff_all on public.reservation_notes;
create policy notes_staff_all on public.reservation_notes for all to authenticated
using (exists (select 1 from public.reservations reservation where reservation.id = reservation_id and public.can_access_location(reservation.location_id)))
with check (exists (select 1 from public.reservations reservation where reservation.id = reservation_id and public.can_access_location(reservation.location_id)));

drop policy if exists events_staff_select on public.reservation_events;
create policy events_staff_select on public.reservation_events for select to authenticated
using (exists (select 1 from public.reservations reservation where reservation.id = reservation_id and public.can_access_location(reservation.location_id)));

drop policy if exists customers_staff_all on public.customers;
create policy customers_staff_select on public.customers for select to authenticated
using (
  public.current_staff_has_central_access()
  or exists (select 1 from public.reservations reservation where reservation.customer_id = public.customers.id and public.can_access_location(reservation.location_id))
);
create policy customers_staff_update on public.customers for update to authenticated
using (
  public.current_staff_has_central_access()
  or exists (select 1 from public.reservations reservation where reservation.customer_id = public.customers.id and public.can_access_location(reservation.location_id))
)
with check (organization_id in (select public.current_staff_org_ids()));
create policy customers_staff_insert on public.customers for insert to authenticated
with check (public.current_staff_has_central_access() and organization_id in (select public.current_staff_org_ids()));

drop policy if exists notifications_staff_all on public.notifications;
create policy notifications_staff_all on public.notifications for all to authenticated
using (
  (public.notifications.reservation_id is not null and exists (select 1 from public.reservations reservation where reservation.id = public.notifications.reservation_id and public.can_access_location(reservation.location_id)))
  or (public.notifications.reservation_id is null and public.current_staff_has_central_access() and organization_id in (select public.current_staff_org_ids()))
)
with check (
  (public.notifications.reservation_id is not null and exists (select 1 from public.reservations reservation where reservation.id = public.notifications.reservation_id and public.can_access_location(reservation.location_id)))
  or (public.notifications.reservation_id is null and public.current_staff_has_central_access() and organization_id in (select public.current_staff_org_ids()))
);
