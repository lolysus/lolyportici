create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  status text not null default 'active' check (status in ('active','suspended','archived')),
  plan text not null default 'standard',
  timezone text not null default 'Europe/Rome',
  default_locale text not null default 'it' check (default_locale in ('it','en','es')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  logo_url text,
  cover_url text,
  phone text,
  email text,
  website text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  default_language text not null default 'it' check (default_language in ('it','en','es')),
  currency char(3) not null default 'EUR',
  brand_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  address text,
  city text,
  province text,
  postal_code text,
  country char(2) not null default 'IT',
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text not null default 'Europe/Rome',
  phone text,
  email text,
  booking_enabled boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dining_areas (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  description text,
  position integer not null default 0,
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  dining_area_id uuid not null references public.dining_areas(id) on delete restrict,
  code text not null,
  display_name text not null,
  minimum_capacity integer not null default 1 check (minimum_capacity > 0),
  maximum_capacity integer not null check (maximum_capacity >= minimum_capacity),
  shape text not null default 'round' check (shape in ('square','rectangle','round','oval','counter')),
  width numeric not null default 80 check (width > 0),
  height numeric not null default 80 check (height > 0),
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  rotation numeric not null default 0,
  is_accessible boolean not null default false,
  is_outdoor boolean not null default false,
  is_strategic boolean not null default false,
  is_active boolean not null default true,
  status text not null default 'available' check (status in ('available','reserved','arriving','occupied','late','cleaning','blocked','out_of_service')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, code)
);

create table public.table_combinations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  minimum_capacity integer not null check (minimum_capacity > 0),
  maximum_capacity integer not null check (maximum_capacity >= minimum_capacity),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create table public.table_combination_items (
  table_combination_id uuid not null references public.table_combinations(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  primary key (table_combination_id, table_id)
);

create table public.service_periods (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 180),
  default_duration_minutes integer not null default 120 check (default_duration_minutes between 30 and 480),
  turnaround_minutes integer not null default 15 check (turnaround_minutes between 0 and 120),
  maximum_covers integer not null check (maximum_covers > 0),
  maximum_arrivals_per_slot integer not null check (maximum_arrivals_per_slot > 0),
  online_booking_enabled boolean not null default true,
  phone_booking_enabled boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table public.special_openings_closures (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  type text not null check (type in ('opening','full_closure','partial_closure','private_event','maintenance')),
  reason text not null,
  affected_area_id uuid references public.dining_areas(id) on delete cascade,
  affected_table_id uuid references public.restaurant_tables(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((start_time is null and end_time is null) or (start_time is not null and end_time is not null and end_time > start_time))
);

create table public.booking_rules (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  service_period_id uuid references public.service_periods(id) on delete cascade,
  dining_area_id uuid references public.dining_areas(id) on delete cascade,
  name text not null,
  channel text,
  minimum_party_size integer not null default 1,
  maximum_party_size integer not null default 10,
  minimum_notice_minutes integer not null default 60,
  maximum_advance_days integer not null default 90,
  default_duration_minutes integer not null default 120,
  turnaround_minutes integer not null default 15,
  requires_manual_approval boolean not null default false,
  requires_deposit boolean not null default false,
  deposit_amount numeric(10,2),
  cancellation_deadline_hours integer not null default 12,
  late_tolerance_minutes integer not null default 15,
  no_show_after_minutes integer not null default 30,
  conditions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (maximum_party_size >= minimum_party_size),
  check (deposit_amount is null or deposit_amount >= 0)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  normalized_phone text not null,
  email text,
  normalized_email text,
  allergies text,
  accessibility_needs text,
  preferred_language text not null default 'it' check (preferred_language in ('it','en','es')),
  birth_date date,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  privacy_consent boolean not null default false,
  privacy_consent_at timestamptz,
  customer_type text not null default 'new' check (customer_type in ('new','regular','loyal','vip','corporate','inactive','no_show_risk')),
  vip_level smallint not null default 0 check (vip_level between 0 and 5),
  total_bookings integer not null default 0,
  completed_bookings integer not null default 0,
  cancelled_bookings integer not null default 0,
  no_show_count integer not null default 0,
  last_visit_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_org_phone_unique on public.customers(organization_id, normalized_phone) where deleted_at is null;
create unique index customers_org_email_unique on public.customers(organization_id, normalized_email) where normalized_email is not null and deleted_at is null;

create table public.customer_preferences (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null,
  value text not null,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  service_period_id uuid not null references public.service_periods(id) on delete restrict,
  reservation_code text not null,
  management_token_hash text not null unique,
  management_token_expires_at timestamptz,
  source text not null check (source in ('web','phone_ai','phone_staff','walk_in','admin','waitlist','integration')),
  status text not null check (status in ('draft','held','pending_confirmation','pending_approval','confirmed','modified','arriving','late','arrived','seated','completed','cancelled_by_customer','cancelled_by_restaurant','no_show','waitlisted','offered','expired')),
  party_size integer not null check (party_size > 0),
  reservation_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 30 and 480),
  dining_area_preference_id uuid references public.dining_areas(id) on delete set null,
  assigned_table_id uuid references public.restaurant_tables(id) on delete set null,
  assigned_combination_id uuid references public.table_combinations(id) on delete set null,
  customer_notes text,
  internal_notes text,
  special_occasion text,
  language text not null default 'it' check (language in ('it','en','es')),
  confirmation_status text not null default 'confirmed',
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  arrival_at timestamptz,
  seated_at timestamptz,
  completed_at timestamptz,
  no_show_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (location_id, reservation_code),
  check (end_at > start_at)
);

create table public.reservation_table_assignments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  unique (reservation_id, table_id),
  exclude using gist (table_id with =, tstzrange(start_at, end_at, '[)') with &&) where (is_active)
);

create table public.reservation_notes (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  type text not null default 'general',
  content text not null,
  visibility text not null check (visibility in ('customer','staff','kitchen','manager')),
  priority smallint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  event_type text not null,
  previous_data jsonb,
  new_data jsonb,
  source text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('customer','staff','voice','system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.reservation_holds (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  session_id text not null,
  source text not null default 'web' check (source in ('web','phone_ai','phone_staff','admin','waitlist','integration')),
  party_size integer not null check (party_size > 0),
  start_at timestamptz not null,
  end_at timestamptz not null,
  table_ids uuid[] not null check (cardinality(table_ids) > 0),
  combination_id uuid references public.table_combinations(id) on delete set null,
  dining_area_id uuid references public.dining_areas(id) on delete set null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','converted','released','expired')),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_snapshot jsonb not null default '{}'::jsonb,
  requested_date date not null,
  requested_start_at timestamptz not null,
  party_size integer not null check (party_size > 0),
  flexibility_minutes integer not null default 60,
  preferred_area_id uuid references public.dining_areas(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting','offered','converted','expired','cancelled')),
  priority integer not null default 0,
  offered_start_at timestamptz,
  offer_expires_at timestamptz,
  converted_reservation_id uuid references public.reservations(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  default_location_id uuid references public.locations(id) on delete set null,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('owner','administrator','manager','receptionist','waiter','phone_operator','analyst')),
  permissions text[] not null default '{}'
);

create table public.staff_user_roles (
  staff_user_id uuid not null references public.staff_users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  primary key (staff_user_id, role_id)
);

create table public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  provider text not null,
  provider_call_id text not null,
  caller_phone text,
  direction text not null default 'inbound',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  status text,
  intent text,
  outcome text,
  reservation_id uuid references public.reservations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  transcript text,
  summary jsonb,
  sentiment text,
  recording_url text,
  human_escalation_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_call_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null check (channel in ('email','sms','whatsapp','dashboard')),
  template text not null,
  recipient text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','cancelled')),
  idempotency_key text not null unique,
  scheduled_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  category text not null,
  question text not null,
  answer text not null,
  language text not null default 'it' check (language in ('it','en','es')),
  is_public boolean not null default true,
  is_active boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text,
  payload jsonb not null,
  status text not null default 'received',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table public.idempotency_keys (
  key text primary key,
  scope text not null,
  request_hash text,
  response_data jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['organizations','restaurants','locations','dining_areas','restaurant_tables','table_combinations','service_periods','booking_rules','customers','customer_preferences','reservations','waitlist_entries','staff_users','knowledge_base']
  loop execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t); end loop;
end $$;
