insert into public.organizations (id,name,slug,status,plan,timezone,default_locale)
values ('00000000-0000-0000-0000-000000000001','Regia Sushi','regia-sushi','active','mvp','Europe/Rome','it')
on conflict (id) do nothing;

insert into public.restaurants (id,organization_id,name,slug,description,status,default_language,currency)
values
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','YUKO Sushi & Fusion','yuko','Ristorante YUKO Sushi & Fusion di Ardea, amministrato dalla regia centrale.','active','it','EUR'),
('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','KouSushi','kousushi','Ristorante KouSushi di Portici, amministrato dalla regia centrale.','active','it','EUR')
on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,status=excluded.status,default_language=excluded.default_language,currency=excluded.currency;

insert into public.locations (id,restaurant_id,name,address,city,province,postal_code,country,timezone,booking_enabled,status)
values
('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','YUKO Sushi & Fusion','Via Severiana','Ardea','RM','00040','IT','Europe/Rome',true,'active'),
('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','KouSushi','Corso Giuseppe Garibaldi, 130','Portici','NA','80055','IT','Europe/Rome',true,'active')
on conflict (id) do nothing;

insert into public.dining_areas (id,location_id,name,position,is_public,is_active) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Sala interna',1,true,true),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','Terrazza',2,true,true)
on conflict (id) do nothing;

insert into public.dining_areas (id,location_id,name,position,is_public,is_active) values
('11000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','Sala interna',1,true,true),
('11000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','Terrazza porto',2,true,true)
on conflict (id) do nothing;

insert into public.restaurant_tables (id,location_id,dining_area_id,code,display_name,minimum_capacity,maximum_capacity,shape,position_x,position_y,is_accessible,is_outdoor,is_strategic,status)
select
  ('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  case when n <= 8 then '10000000-0000-0000-0000-000000000001'::uuid else '10000000-0000-0000-0000-000000000002'::uuid end,
  'T' || n,
  'Tavolo ' || n,
  case when n in (7,8,13,14) then 4 else 1 end,
  case when n in (1,2,9,10) then 2 when n in (7,13,14) then 6 when n = 8 then 8 else 4 end,
  case when n in (7,8,13,14) then 'rectangle' else 'round' end,
  ((n - 1) % 4) * 24 + 12,
  floor((n - 1) / 4) * 22 + 12,
  n in (1,9),
  n > 8,
  n in (7,8,13,14),
  case when n = 15 then 'blocked' else 'available' end
from generate_series(1,15) n
on conflict (id) do nothing;

insert into public.restaurant_tables (id,location_id,dining_area_id,code,display_name,minimum_capacity,maximum_capacity,shape,position_x,position_y,is_accessible,is_outdoor,is_strategic,status)
select
  ('21000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid,
  case when n <= 7 then '11000000-0000-0000-0000-000000000001'::uuid else '11000000-0000-0000-0000-000000000002'::uuid end,
  'M' || n,
  'Tavolo Mare ' || n,
  case when n in (6,7,11,12) then 4 else 1 end,
  case when n in (1,2,8,9) then 2 when n in (6,11,12) then 6 when n = 7 then 8 else 4 end,
  case when n in (6,7,11,12) then 'rectangle' else 'round' end,
  ((n - 1) % 4) * 24 + 12,
  floor((n - 1) / 4) * 26 + 12,
  n in (1,8),
  n > 7,
  n in (6,7,11,12),
  'available'
from generate_series(1,12) n
on conflict (id) do nothing;

insert into public.table_combinations (id,location_id,name,minimum_capacity,maximum_capacity,is_active) values
('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','T5 + T6',5,8,true),
('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','T11 + T12',5,8,true)
on conflict (id) do nothing;
insert into public.table_combination_items (table_combination_id,table_id) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005'),
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000011'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000012')
on conflict do nothing;

insert into public.service_periods (id,location_id,name,day_of_week,start_time,end_time,slot_interval_minutes,default_duration_minutes,turnaround_minutes,maximum_covers,maximum_arrivals_per_slot,online_booking_enabled,phone_booking_enabled,is_active)
select ('40000000-0000-0000-0001-' || lpad(d::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000003'::uuid,'Pranzo',d,'12:00'::time,'15:00'::time,30,120,15,54,7,true,true,true from unnest(array[0,6]) d
union all
select ('40000000-0000-0000-0002-' || lpad(d::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000003'::uuid,'Cena',d,'19:00'::time,'23:30'::time,30,120,15,62,8,true,true,true from generate_series(0,6) d
on conflict (id) do nothing;

insert into public.service_periods (id,location_id,name,day_of_week,start_time,end_time,slot_interval_minutes,default_duration_minutes,turnaround_minutes,maximum_covers,maximum_arrivals_per_slot,online_booking_enabled,phone_booking_enabled,is_active)
select ('41000000-0000-0000-0001-' || lpad(d::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000004'::uuid,'Pranzo',d,'12:00'::time,'15:00'::time,30,120,15,42,6,true,true,true from unnest(array[0,6]) d
union all
select ('41000000-0000-0000-0002-' || lpad(d::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000004'::uuid,'Cena',d,'19:00'::time,'23:30'::time,30,120,15,48,6,true,true,true from generate_series(0,6) d
on conflict (id) do nothing;

insert into public.booking_rules (location_id,name,minimum_party_size,maximum_party_size,minimum_notice_minutes,maximum_advance_days,default_duration_minutes,turnaround_minutes,requires_manual_approval,cancellation_deadline_hours,late_tolerance_minutes,no_show_after_minutes)
values
('00000000-0000-0000-0000-000000000003','Regola YUKO',1,10,60,90,120,15,false,12,15,30),
('00000000-0000-0000-0000-000000000004','Regola KouSushi',1,10,60,90,120,15,false,12,15,30);

insert into public.roles (name,permissions) values
('owner',array['*']),
('administrator',array['*']),
('manager',array['*']),
('receptionist',array['reservations:*','floor:read','customers:read','customers:write']),
('waiter',array['reservations:read','floor:read','floor:write','customers:read']),
('phone_operator',array['reservations:*','customers:read','calls:read']),
('analyst',array['analytics:read','reservations:read'])
on conflict (name) do update set permissions = excluded.permissions;

insert into public.customers (id,organization_id,first_name,last_name,phone,normalized_phone,email,normalized_email,preferred_language,marketing_consent,privacy_consent,customer_type,total_bookings,no_show_count) values
('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Giulia','Bianchi (Demo)','+390000000001','+390000000001','giulia.demo@example.test','giulia.demo@example.test','it',true,true,'vip',14,0),
('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Marco','Rossi (Demo)','+390000000002','+390000000002','marco.demo@example.test','marco.demo@example.test','it',false,true,'regular',6,1),
('50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Elena','Verdi (Demo)','+390000000003','+390000000003',null,null,'en',false,true,'new',1,0)
on conflict (id) do nothing;

insert into public.knowledge_base (restaurant_id,location_id,category,question,answer,language,is_public,is_active,priority) values
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','orari','Quali sono gli orari?','Gli orari disponibili sono mostrati nel calendario di prenotazione. Per informazioni contatta direttamente YUKO.','it',true,true,10),
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','accessibilità','Il ristorante è accessibile?','Sono disponibili tavoli accessibili; segnalare la necessità durante la prenotazione.','it',true,true,8),
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','allergeni','Come comunico un allergene?','Indicare sempre allergie e intolleranze durante la prenotazione; i casi gravi vengono trasferiti al personale.','it',true,true,10),
('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004','orari','Quali sono gli orari?','Gli orari disponibili sono mostrati nel calendario di KouSushi.','it',true,true,10),
('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004','allergeni','Come comunico un allergene?','Indicare allergie e intolleranze durante la prenotazione; lo staff di KouSushi verifichera la richiesta.','it',true,true,10);

insert into public.reservations (
  id,organization_id,restaurant_id,location_id,customer_id,service_period_id,
  reservation_code,management_token_hash,source,status,party_size,reservation_date,
  start_at,end_at,duration_minutes,dining_area_preference_id,assigned_table_id,
  customer_notes,special_occasion,language,confirmed_at
)
select
  seed.id::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  seed.customer_id::uuid,
  service.id,
  seed.code,
  'demo-management-token-' || seed.code,
  seed.source,
  seed.status,
  seed.party_size,
  current_date,
  (current_date + seed.start_time) at time zone 'Europe/Rome',
  ((current_date + seed.start_time) at time zone 'Europe/Rome') + make_interval(mins => seed.duration_minutes + 15),
  seed.duration_minutes,
  seed.area_id::uuid,
  seed.table_id::uuid,
  seed.note,
  seed.occasion,
  seed.language,
  now()
from (values
  ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','YK-2401','web','confirmed',4,'19:30'::time,120,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','Anniversario','Anniversario','it'),
  ('60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','YK-2402','phone_ai','arriving',2,'20:00'::time,90,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',null,null,'it'),
  ('60000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003','YK-2403','admin','confirmed',6,'20:30'::time,150,'10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000013','Accesso senza gradini',null,'en')
) as seed(id,customer_id,code,source,status,party_size,start_time,duration_minutes,area_id,table_id,note,occasion,language)
join lateral (
  select id from public.service_periods
  where location_id = '00000000-0000-0000-0000-000000000003'
    and name = 'Cena'
    and day_of_week = extract(dow from current_date)::integer
  limit 1
) service on true
on conflict (id) do nothing;

insert into public.reservations (
  id,organization_id,restaurant_id,location_id,customer_id,service_period_id,
  reservation_code,management_token_hash,source,status,party_size,reservation_date,
  start_at,end_at,duration_minutes,dining_area_preference_id,assigned_table_id,
  customer_notes,special_occasion,language,confirmed_at
)
select
  seed.id::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000005'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid,
  seed.customer_id::uuid,
  service.id,
  seed.code,
  'demo-management-token-' || seed.code,
  seed.source,
  seed.status,
  seed.party_size,
  current_date,
  (current_date + seed.start_time) at time zone 'Europe/Rome',
  ((current_date + seed.start_time) at time zone 'Europe/Rome') + make_interval(mins => seed.duration_minutes + 15),
  seed.duration_minutes,
  seed.area_id::uuid,
  seed.table_id::uuid,
  seed.note,
  seed.occasion,
  seed.language,
  now()
from (values
  ('60000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000002','KS-2401','web','confirmed',2,'19:30'::time,120,'11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000002',null,null,'it'),
  ('60000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000003','KS-2402','phone_ai','arriving',4,'20:00'::time,90,'11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000005','Compleanno',null,'it'),
  ('60000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000001','KS-2403','admin','confirmed',6,'20:30'::time,150,'11000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000011','Allergia dichiarata',null,'it')
) as seed(id,customer_id,code,source,status,party_size,start_time,duration_minutes,area_id,table_id,note,occasion,language)
join lateral (
  select id from public.service_periods
  where location_id = '00000000-0000-0000-0000-000000000004'
    and name = 'Cena'
    and day_of_week = extract(dow from current_date)::integer
  limit 1
) service on true
on conflict (id) do nothing;

insert into public.reservation_table_assignments (reservation_id,table_id,start_at,end_at)
select id,assigned_table_id,start_at,end_at
from public.reservations
where id in (
  '60000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000003',
  '60000000-0000-0000-0000-000000000004',
  '60000000-0000-0000-0000-000000000005',
  '60000000-0000-0000-0000-000000000006'
)
on conflict (reservation_id,table_id) do nothing;

insert into public.waitlist_entries (
  id,location_id,customer_id,customer_snapshot,requested_date,requested_start_at,
  party_size,flexibility_minutes,status,priority,notes
) values
('70000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002','{"firstName":"Marco","lastName":"Rossi (Demo)","phone":"+390000000002"}',current_date,(current_date + time '21:00') at time zone 'Europe/Rome',2,30,'waiting',2,'Dato dimostrativo'),
('70000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',null,'{"firstName":"Sara","lastName":"Demo","phone":"+390000000011"}',current_date,(current_date + time '20:30') at time zone 'Europe/Rome',4,60,'offered',1,'Dato dimostrativo'),
('70000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','{"firstName":"Giulia","lastName":"Bianchi (Demo)","phone":"+390000000001"}',current_date,(current_date + time '21:00') at time zone 'Europe/Rome',2,45,'waiting',1,'Dato dimostrativo KouSushi')
on conflict (id) do nothing;

insert into public.voice_calls (
  id,location_id,provider,provider_call_id,caller_phone,started_at,ended_at,
  duration_seconds,status,intent,outcome,reservation_id,customer_id,summary,sentiment,
  human_escalation_required
) values
('80000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','retell','call_demo_01','+390000000020',(current_date + time '17:44') at time zone 'Europe/Rome',(current_date + time '17:46:12') at time zone 'Europe/Rome',132,'completed','Nuova prenotazione','Prenotazione creata','60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','{"text":"Cena per due persone alle 20:00."}','positive',false),
('80000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','retell','call_demo_02','+390000000021',(current_date + time '18:12') at time zone 'Europe/Rome',(current_date + time '18:13:21') at time zone 'Europe/Rome',81,'callback_requested','Evento privato','Richiamata richiesta',null,null,'{"text":"Richiesta per gruppo numeroso; escalation al manager."}','neutral',true),
('80000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','retell','call_demo_03','+390000000022',(current_date + time '18:35') at time zone 'Europe/Rome',(current_date + time '18:36:09') at time zone 'Europe/Rome',69,'completed','Nuova prenotazione','Prenotazione creata','60000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000003','{"text":"Prenotazione per quattro persone alle 20:00."}','positive',false)
on conflict (id) do nothing;
