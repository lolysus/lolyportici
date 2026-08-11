-- Le iscrizioni push del personale, una per dispositivo installato.
--
-- Ogni volta che un cliente prenota, il backend spedisce una notifica push a
-- tutti i dispositivi iscritti di quella sede. L'iscrizione la crea il browser
-- (endpoint + chiavi) quando lo staff, dopo aver installato la PWA ed essere
-- entrato, accende le notifiche. È legata alla sede come tutto il resto: una
-- prenotazione di Portici non fa vibrare i telefoni di Ardea.
--
-- `endpoint` è unico: lo stesso dispositivo che si re-iscrive aggiorna la riga
-- invece di crearne una seconda, così non arrivano notifiche doppie.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_location_idx on public.push_subscriptions(location_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant all on public.push_subscriptions to service_role;
