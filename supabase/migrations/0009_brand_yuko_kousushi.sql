-- Rebrand the two independent restaurants without changing their stable IDs.
update public.organizations
set name = 'Regia Sushi', slug = 'regia-sushi'
where id = '00000000-0000-0000-0000-000000000001';

update public.restaurants
set
  name = 'YUKO Sushi & Fusion',
  slug = 'yuko',
  description = 'Ristorante YUKO Sushi & Fusion di Ardea, amministrato dalla regia centrale.'
where id = '00000000-0000-0000-0000-000000000002';

update public.restaurants
set
  name = 'KouSushi',
  slug = 'kousushi',
  description = 'Ristorante KouSushi di Portici, amministrato dalla regia centrale.'
where id = '00000000-0000-0000-0000-000000000005';

update public.locations
set
  name = 'YUKO Sushi & Fusion',
  address = 'Via Severiana',
  city = 'Ardea',
  province = 'RM',
  postal_code = '00040',
  country = 'IT',
  timezone = 'Europe/Rome'
where id = '00000000-0000-0000-0000-000000000003';

update public.locations
set
  name = 'KouSushi',
  address = 'Corso Giuseppe Garibaldi, 130',
  city = 'Portici',
  province = 'NA',
  postal_code = '80055',
  country = 'IT',
  timezone = 'Europe/Rome'
where id = '00000000-0000-0000-0000-000000000004';

update public.booking_rules
set name = 'Regola YUKO'
where location_id = '00000000-0000-0000-0000-000000000003' and is_active = true;

update public.booking_rules
set name = 'Regola KouSushi'
where location_id = '00000000-0000-0000-0000-000000000004' and is_active = true;
