-- The organization owns two independent restaurants. Each restaurant currently
-- has one operational location, but permissions and all runtime operations stay
-- location-scoped so additional locations can be added later without redesign.
insert into public.restaurants (
  id, organization_id, name, slug, description, status, default_language, currency
)
values (
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'Ristorante Sushi Mare',
  'ristorante-sushi-mare',
  'Secondo ristorante indipendente amministrato dalla regia centrale.',
  'active',
  'it',
  'EUR'
)
on conflict (id) do update set
  organization_id = excluded.organization_id,
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  status = excluded.status,
  default_language = excluded.default_language,
  currency = excluded.currency;

update public.restaurants
set
  name = 'Ristorante Sushi Centro',
  slug = 'ristorante-sushi-centro',
  description = 'Primo ristorante indipendente amministrato dalla regia centrale.'
where id = '00000000-0000-0000-0000-000000000002';

update public.locations
set restaurant_id = '00000000-0000-0000-0000-000000000005'
where id = '00000000-0000-0000-0000-000000000004';

update public.reservations
set restaurant_id = '00000000-0000-0000-0000-000000000005'
where location_id = '00000000-0000-0000-0000-000000000004'
  and restaurant_id <> '00000000-0000-0000-0000-000000000005';
update public.knowledge_base
set restaurant_id = '00000000-0000-0000-0000-000000000005'
where location_id = '00000000-0000-0000-0000-000000000004'
  and restaurant_id <> '00000000-0000-0000-0000-000000000005';
