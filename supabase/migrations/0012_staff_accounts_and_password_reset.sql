-- Account dello staff e reimpostazione della password.
--
-- Finora le credenziali vivevano in `AUTH_USERS_JSON`, una variabile
-- d'ambiente. Va benissimo per far entrare due persone, ma una variabile
-- d'ambiente non si riscrive mentre il programma gira: senza un posto dove
-- salvare la nuova password, "ho dimenticato la password" non poteva esistere.
--
-- `staff_users` non serviva allo scopo: ha un vincolo verso `auth.users`, cioè
-- l'autenticazione di Supabase, che in produzione (Postgres su Railway) non
-- c'è. Questa tabella è indipendente e si basta da sola.
--
-- Il passaggio è senza interruzioni: chi non è ancora qui dentro continua a
-- entrare con le credenziali della variabile d'ambiente, e ci finisce da solo
-- la prima volta che reimposta la password.
create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null,
  -- scrypt, stesso schema già in uso: salt e hash separati, mai la password.
  password_salt text not null,
  password_hash text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- L'indirizzo identifica l'account e si confronta senza distinzione fra
-- maiuscole e minuscole: "Mario@..." e "mario@..." sono la stessa persona, e
-- due righe per la stessa persona sarebbero due password diverse.
create unique index if not exists staff_accounts_email_idx
  on public.staff_accounts(lower(email));

create index if not exists staff_accounts_location_idx
  on public.staff_accounts(location_id)
  where status = 'active';

-- Richieste di reimpostazione.
--
-- Del token si conserva solo l'impronta: chi legge il database non deve
-- poterne ricavare un link funzionante. La riga resta anche dopo l'uso, così
-- un secondo tentativo con lo stesso link viene riconosciuto e rifiutato
-- invece di sembrare semplicemente scaduto.
create table if not exists public.staff_password_resets (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists staff_password_resets_email_idx
  on public.staff_password_resets(lower(email), created_at desc);

-- I token scaduti e usati non servono più a nulla: l'indice li tiene a portata
-- per la pulizia periodica senza scansionare tutta la tabella.
create index if not exists staff_password_resets_cleanup_idx
  on public.staff_password_resets(expires_at)
  where used_at is null;
