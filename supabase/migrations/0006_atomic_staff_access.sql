create or replace function public.update_staff_access(
  p_staff_id uuid,
  p_organization_id uuid,
  p_location_id uuid,
  p_role_id uuid,
  p_status text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_staff public.staff_users%rowtype;
begin
  if p_status not in ('active', 'invited', 'suspended') then
    raise exception 'INVALID_STAFF_STATUS';
  end if;

  select * into v_staff
  from public.staff_users
  where id = p_staff_id and organization_id = p_organization_id
  for update;
  if not found then raise exception 'STAFF_NOT_FOUND'; end if;

  if exists (
    select 1
    from public.staff_user_roles assignment
    join public.roles role on role.id = assignment.role_id
    where assignment.staff_user_id = p_staff_id and role.name = 'owner'
  ) then
    raise exception 'OWNER_PROTECTED';
  end if;

  if not exists (select 1 from public.roles where id = p_role_id and name <> 'owner') then
    raise exception 'INVALID_STAFF_ROLE';
  end if;

  update public.staff_users
  set status = p_status, updated_at = now()
  where id = p_staff_id;

  -- Insert first, then remove only the other roles for the managed location.
  -- The transaction preserves a valid role assignment even if a later step fails
  -- and leaves assignments for other locations untouched.
  insert into public.staff_user_roles (staff_user_id, role_id, location_id)
  values (p_staff_id, p_role_id, p_location_id)
  on conflict (staff_user_id, role_id)
  do update set location_id = excluded.location_id;

  delete from public.staff_user_roles
  where staff_user_id = p_staff_id
    and location_id = p_location_id
    and role_id <> p_role_id;
end; $$;

revoke all on function public.update_staff_access(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.update_staff_access(uuid,uuid,uuid,uuid,text) to service_role;
